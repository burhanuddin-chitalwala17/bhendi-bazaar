/**
 * Recurring work is an in-process timer that enqueues a singleton job (worker-foundation, the
 * shape jobs.config.ts reserves for schedules): the floor and the count are budgeted, a tick
 * sends an envelope keyed so one is ever waiting, and the media sweep is registered on it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("@server/catalog/media-asset.service", () => ({
  mediaAssetService: { sweep: vi.fn().mockResolvedValue({ pending: { removed: 1, kept: 0 }, retired: { deleted: 0, kept: 2 } }) },
}));
vi.mock("@server/payments/payment.service", () => ({
  paymentService: { reconcileStuckOrders: vi.fn() },
}));

import { JOBS_MAX_SCHEDULES, JOBS_SCHEDULE_MIN_INTERVAL_SECONDS } from "@server/shared/jobs/jobs.config";
import { registerJob, registeredJobTypes, resetJobRegistry, resolveJob } from "@server/shared/jobs/jobs.registry";
import {
  registerSchedule,
  registeredSchedules,
  resetSchedules,
  scheduleSend,
  startSchedules,
} from "@server/shared/jobs/jobs.schedule";

const noop = (type: string) => registerJob({ type, schema: z.object({}), handler: async () => {} });

describe("the schedule seam", () => {
  beforeEach(() => {
    resetJobRegistry();
    resetSchedules();
  });
  afterEach(() => vi.useRealTimers());

  it("refuses a schedule under the floor — a tick is a query, and the idle budget counts them", () => {
    expect(() => registerSchedule(noop("fast"), {}, JOBS_SCHEDULE_MIN_INTERVAL_SECONDS - 1)).toThrow(/floor/);
    expect(registeredSchedules()).toEqual([]);
  });

  it("refuses the same type twice and more schedules than the estimate budgets", () => {
    registerSchedule(noop("one"), {}, JOBS_SCHEDULE_MIN_INTERVAL_SECONDS);
    expect(() => registerSchedule(noop("one-again"), {}, JOBS_SCHEDULE_MIN_INTERVAL_SECONDS)).not.toThrow();
    expect(() => registerSchedule(registeredSchedules()[0].definition, {}, JOBS_SCHEDULE_MIN_INTERVAL_SECONDS)).toThrow(/twice/);
    for (let i = registeredSchedules().length; i < JOBS_MAX_SCHEDULES; i++) {
      registerSchedule(noop(`fill-${i}`), {}, JOBS_SCHEDULE_MIN_INTERVAL_SECONDS);
    }
    expect(() => registerSchedule(noop("overflow"), {}, JOBS_SCHEDULE_MIN_INTERVAL_SECONDS)).toThrow(/JOBS_MAX_SCHEDULES/);
  });

  it("a tick sends the job's envelope keyed as a singleton, so a slow worker never queues two", () => {
    const schedule = registerSchedule(noop("sweep"), {}, JOBS_SCHEDULE_MIN_INTERVAL_SECONDS);
    expect(scheduleSend(schedule)).toEqual({
      data: { type: "sweep", payload: {} },
      options: { singletonKey: "schedule:sweep" },
    });
  });

  it("ticks once on start, then once per interval, and stops cleanly", async () => {
    vi.useFakeTimers();
    registerSchedule(noop("sweep"), {}, JOBS_SCHEDULE_MIN_INTERVAL_SECONDS);
    const send = vi.fn().mockResolvedValue("job-id");
    const stop = startSchedules(send);
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(JOBS_SCHEDULE_MIN_INTERVAL_SECONDS * 1000);
    expect(send).toHaveBeenCalledTimes(2);
    stop();
    await vi.advanceTimersByTimeAsync(JOBS_SCHEDULE_MIN_INTERVAL_SECONDS * 1000);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("a tick that cannot enqueue is logged, not thrown — the next tick tries again", async () => {
    vi.useFakeTimers();
    registerSchedule(noop("sweep"), {}, JOBS_SCHEDULE_MIN_INTERVAL_SECONDS);
    const log = vi.fn();
    const stop = startSchedules(vi.fn().mockRejectedValue(new Error("no connection")), log);
    await vi.advanceTimersByTimeAsync(0);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("no connection"));
    stop();
  });
});

describe("the media sweep", () => {
  it("is a registered job on a schedule at or above the floor, and its handler runs both sweeps", async () => {
    resetJobRegistry();
    resetSchedules();
    // Imported here, after the reset, so the registration lands in the registry this test reads.
    const { MEDIA_SWEEP_INTERVAL_SECONDS } = await import("@server/catalog/media.jobs");
    const { mediaAssetService } = await import("@server/catalog/media-asset.service");
    expect(registeredJobTypes()).toContain("media.sweep");
    expect(MEDIA_SWEEP_INTERVAL_SECONDS).toBeGreaterThanOrEqual(JOBS_SCHEDULE_MIN_INTERVAL_SECONDS);
    expect(registeredSchedules().map((s) => [s.definition.type, s.everySeconds])).toEqual([["media.sweep", MEDIA_SWEEP_INTERVAL_SECONDS]]);
    const { definition, payload } = resolveJob({ type: "media.sweep", payload: {} });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await definition.handler({ jobId: "j1", payload });
    expect(mediaAssetService.sweep).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("pending removed 1"));
    log.mockRestore();
  });
});

describe("the payment reconciliation", () => {
  // One test, because the job module registers itself on import and an import is cached: a
  // second `resetJobRegistry` with a second import would leave the registry empty. The media
  // sweep above is written the same way for the same reason.
  it("is scheduled at the floor, and reports every run including the quiet ones", async () => {
    resetJobRegistry();
    resetSchedules();
    const { PAYMENT_RECONCILE_INTERVAL_SECONDS } = await import("@server/payments/payment.jobs");
    const { paymentService } = await import("@server/payments/payment.service");

    expect(registeredJobTypes()).toContain("payment.reconcile");
    expect(PAYMENT_RECONCILE_INTERVAL_SECONDS).toBeGreaterThanOrEqual(JOBS_SCHEDULE_MIN_INTERVAL_SECONDS);
    expect(registeredSchedules().map((entry) => [entry.definition.type, entry.everySeconds])).toEqual([
      ["payment.reconcile", PAYMENT_RECONCILE_INTERVAL_SECONDS],
    ]);

    const { definition, payload } = resolveJob({ type: "payment.reconcile", payload: {} });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    // A quiet run still reports. The handler this replaced logged only when it had recovered
    // something, so a sweep that found nothing and a sweep that never ran looked alike.
    vi.mocked(paymentService.reconcileStuckOrders).mockResolvedValue([]);
    await definition.handler({ jobId: "j2", payload });
    expect(log).toHaveBeenLastCalledWith(expect.stringContaining("examined 0"));

    // Each outcome counted separately: a confirmation and a release are not one number.
    vi.mocked(paymentService.reconcileStuckOrders).mockResolvedValue([
      { orderId: "o1", outcome: "confirmed" },
      { orderId: "o2", outcome: "released" },
      { orderId: "o3", outcome: "released" },
      { orderId: "o4", outcome: "in-flight" },
      { orderId: "o5", outcome: "error" },
    ] as Awaited<ReturnType<typeof paymentService.reconcileStuckOrders>>);
    await definition.handler({ jobId: "j3", payload });

    const line = log.mock.calls.at(-1)?.[0] as string;
    expect(line).toContain("examined 5");
    expect(line).toContain("confirmed 1");
    expect(line).toContain("released 2");
    expect(line).toContain("still in flight 1");
    expect(line).toContain("errors 1");
    log.mockRestore();
  });
});
