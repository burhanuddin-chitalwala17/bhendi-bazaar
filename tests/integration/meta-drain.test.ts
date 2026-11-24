/**
 * The drain against a real database (meta-foundation unit 3, ADR-0078): stored events become facts
 * handed to sinks in the order they happened, once; a failing sink stops the run without losing
 * order; a poison event dies after five tries and stops blocking; one drain per account at a time.
 */
import "dotenv/config";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";

const SECRET = "integration-drain-secret";
const RUN = Date.now();
const SHOP = { phone: `DRAIN-PHONE-${RUN}`, business: `DRAIN-WABA-${RUN}` };

function delivery(messages: Array<{ id: string; at: number; text: string }>) {
  return Buffer.from(
    JSON.stringify({
      object: "whatsapp_business_account",
      entry: [
        {
          id: SHOP.business,
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: SHOP.phone },
                contacts: [{ profile: { name: "Ayesha" }, wa_id: "919811111111" }],
                messages: messages.map((m) => ({ id: m.id, from: "919811111111", timestamp: String(m.at), type: "text", text: { body: m.text } })),
              },
            },
          ],
        },
      ],
    }),
  );
}
const sign = (raw: Buffer) => `sha256=${createHmac("sha256", SECRET).update(raw).digest("hex")}`;

describe.skipIf(!isDisposableDb)("Meta event drain (local db)", () => {
  let connectionId = "";

  beforeAll(async () => {
    process.env.META_APP_SECRET = SECRET;
    const { prisma } = await import("@server/shared/prisma");
    const { orgId } = await ensureFixtures();
    await prisma.channelConnection.deleteMany({ where: { orgId, channel: "whatsapp" } });
    connectionId = (
      await prisma.channelConnection.create({
        data: { orgId, channel: "whatsapp", state: "CONNECTED", accessToken: "sealed-placeholder", externalPhoneId: SHOP.phone, externalBusinessId: SHOP.business },
        select: { id: true },
      })
    ).id;
  });

  afterEach(async () => {
    const { resetSinks } = await import("@server/shared/social-events/sinks");
    const { prisma } = await import("@server/shared/prisma");
    resetSinks();
    await prisma.metaEvent.deleteMany({ where: { connectionId } });
  });

  afterAll(async () => {
    const { prisma } = await import("@server/shared/prisma");
    await prisma.channelConnection.deleteMany({ where: { id: connectionId } });
  });

  async function store(messages: Array<{ id: string; at: number; text: string }>) {
    const { metaIntakeService } = await import("@server/channels/meta-intake.service");
    const raw = delivery(messages);
    await metaIntakeService.receive("whatsapp", raw, sign(raw));
  }

  it("hands every stored event on as a fact, in the order it happened, once (spec A1, R4)", async () => {
    const { registerSink } = await import("@server/shared/social-events/sinks");
    const { metaDrainService } = await import("@server/channels/meta-drain.service");
    const { prisma } = await import("@server/shared/prisma");
    const seen: string[] = [];
    registerSink({ name: "test", kind: "inbound-message", order: 0, handle: async (facts) => void seen.push(...facts.map((f) => f.text ?? "")) });
    // Delivered out of order; drained in the order they happened.
    await store([{ id: `m3-${RUN}`, at: 1764000030, text: "third" }]);
    await store([{ id: `m1-${RUN}`, at: 1764000010, text: "first" }, { id: `m2-${RUN}`, at: 1764000020, text: "second" }]);

    const result = await metaDrainService.drain(connectionId);
    expect(result).toMatchObject({ claimed: true, handed: 3, dead: 0, retryAfterSeconds: null });
    expect(seen).toEqual(["first", "second", "third"]);
    expect(await prisma.metaEvent.count({ where: { connectionId, state: "DONE" } })).toBe(3);

    await metaDrainService.drain(connectionId);
    expect(seen).toHaveLength(3);
  });

  it("stops at a failing sink, keeps the rest pending in order, and asks again later", async () => {
    const { registerSink } = await import("@server/shared/social-events/sinks");
    const { metaDrainService } = await import("@server/channels/meta-drain.service");
    const { prisma } = await import("@server/shared/prisma");
    const seen: string[] = [];
    // Fails in the batch and again in the one-at-a-time replay, so the run must stop.
    let failures = 2;
    registerSink({
      name: "flaky",
      kind: "inbound-message",
      order: 0,
      handle: async (facts) => {
        for (const fact of facts) {
          if (fact.text === "second" && failures > 0) {
            failures -= 1;
            throw new Error("sink down");
          }
          seen.push(fact.text ?? "");
        }
      },
    });
    await store([
      { id: `f1-${RUN}`, at: 1764000010, text: "first" },
      { id: `f2-${RUN}`, at: 1764000020, text: "second" },
      { id: `f3-${RUN}`, at: 1764000030, text: "third" },
    ]);
    const first = await metaDrainService.drain(connectionId);
    expect(first.retryAfterSeconds).toBe(30);
    const pending = await prisma.metaEvent.findMany({ where: { connectionId, state: "PENDING" }, orderBy: { occurredAt: "asc" } });
    // A sink that was down delays the event; it does not count toward dead.
    expect(pending.map((e) => [e.attempts, e.retries])).toEqual([[0, 1], [0, 0]]);
    const second = await metaDrainService.drain(connectionId);
    expect(second).toMatchObject({ handed: 2, retryAfterSeconds: null });
    expect(seen.filter((t) => t !== "first")).toEqual(["second", "third"]);
  });

  it("a poison event dies after five tries and stops blocking the shop's other events", async () => {
    const { registerSink, PermanentFactError } = await import("@server/shared/social-events/sinks");
    const { metaDrainService } = await import("@server/channels/meta-drain.service");
    const { prisma } = await import("@server/shared/prisma");
    const seen: string[] = [];
    registerSink({
      name: "poisoned",
      kind: "inbound-message",
      order: 0,
      handle: async (facts) => {
        for (const fact of facts) {
          if (fact.text === "poison") throw new PermanentFactError("names nothing that exists");
          seen.push(fact.text ?? "");
        }
      },
    });
    await store([
      { id: `p1-${RUN}`, at: 1764000010, text: "poison" },
      { id: `p2-${RUN}`, at: 1764000020, text: "after" },
    ]);
    for (let i = 0; i < 4; i++) await metaDrainService.drain(connectionId);
    expect(seen).toEqual([]);
    const fifth = await metaDrainService.drain(connectionId);
    expect(fifth).toMatchObject({ dead: 1, handed: 1 });
    expect(seen).toEqual(["after"]);
    const poison = await prisma.metaEvent.findFirst({ where: { connectionId, state: "DEAD" } });
    expect(poison).toMatchObject({ attempts: 5, lastErrorCode: "PermanentFactError" });
  });

  it("a sink that is down delays events and never kills them, backing off", async () => {
    const { registerSink } = await import("@server/shared/social-events/sinks");
    const { metaDrainService } = await import("@server/channels/meta-drain.service");
    const { prisma } = await import("@server/shared/prisma");
    let down = true;
    const seen: string[] = [];
    registerSink({
      name: "outage",
      kind: "inbound-message",
      order: 0,
      handle: async (facts) => {
        if (down) throw new Error("connection refused");
        seen.push(...facts.map((f) => f.text ?? ""));
      },
    });
    await store([{ id: `o1-${RUN}`, at: 1764000010, text: "kept" }]);
    const delays: Array<number | null> = [];
    for (let i = 0; i < 8; i++) delays.push((await metaDrainService.drain(connectionId)).retryAfterSeconds);
    const event = await prisma.metaEvent.findFirst({ where: { connectionId } });
    expect(event).toMatchObject({ state: "PENDING", attempts: 0, retries: 8 });
    expect(delays.slice(0, 4)).toEqual([30, 60, 120, 240]);
    down = false;
    await metaDrainService.drain(connectionId);
    expect(seen).toEqual(["kept"]);
  });

  it("a drain whose lease was taken over hands on and writes nothing more", async () => {
    const { registerSink } = await import("@server/shared/social-events/sinks");
    const { metaDrainService } = await import("@server/channels/meta-drain.service");
    const { connectionLaneRepository } = await import("@server/channels/connection-lane.repository");
    const { prisma } = await import("@server/shared/prisma");
    registerSink({
      name: "slow",
      kind: "inbound-message",
      order: 0,
      // While this sink runs, the lease runs out and another worker takes the lane.
      handle: async () => {
        await connectionLaneRepository.expire(connectionId, "events");
        await connectionLaneRepository.claim(connectionId, "events", "other-worker", 60);
      },
    });
    let afterRan = false;
    registerSink({ name: "after", kind: "inbound-message", order: 1, handle: async () => void (afterRan = true) });
    await store([{ id: `l1-${RUN}`, at: 1764000010, text: "x" }]);
    const result = await metaDrainService.drain(connectionId, "first-worker");
    expect(result.handed).toBe(0);
    expect(afterRan).toBe(false);
    expect(await prisma.metaEvent.count({ where: { connectionId, state: "PENDING" } })).toBe(1);
    await connectionLaneRepository.release(connectionId, "events", "other-worker");
  });

  it("several events in one second keep the order Meta sent them", async () => {
    const { registerSink } = await import("@server/shared/social-events/sinks");
    const { metaDrainService } = await import("@server/channels/meta-drain.service");
    const seen: string[] = [];
    registerSink({ name: "same-second", kind: "inbound-message", order: 0, handle: async (facts) => void seen.push(...facts.map((f) => f.text ?? "")) });
    await store(["a", "b", "c", "d", "e"].map((t) => ({ id: `s-${t}-${RUN}`, at: 1764000010, text: t })));
    await metaDrainService.drain(connectionId);
    expect(seen).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("a second request in the same second takes the spare slot rather than being swallowed", async () => {
    const { metaDrainService } = await import("@server/channels/meta-drain.service");
    const { ensureFixtures: fixtures } = await import("../helpers/test-db");
    const { orgId } = await fixtures();
    const fresh = `slot-test-${RUN}`;
    expect(await metaDrainService.request(fresh, orgId)).toBe(true);
    expect(await metaDrainService.request(fresh, orgId)).toBe(true);
  });

  it("one drain per account at a time: a second drain while the lease is held does nothing", async () => {
    const { connectionLaneRepository } = await import("@server/channels/connection-lane.repository");
    const { metaDrainService } = await import("@server/channels/meta-drain.service");
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) => connectionLaneRepository.claim(connectionId, "events", `worker-${i}`, 60)),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    const busy = await metaDrainService.drain(connectionId, "late-worker");
    expect(busy).toMatchObject({ claimed: false, retryAfterSeconds: 5 });
    const winner = `worker-${results.indexOf(true)}`;
    await connectionLaneRepository.release(connectionId, "events", winner);
    expect((await metaDrainService.drain(connectionId, "late-worker")).claimed).toBe(true);
  });

  it("the intake asks for a drain of the connection it stored for", async () => {
    const { prisma } = await import("@server/shared/prisma");
    await store([{ id: `q1-${RUN}`, at: 1764000010, text: "hello" }]);
    const jobs = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*)::bigint AS n FROM pgboss.job WHERE data->>'type' = 'channels.drain-events' AND data->'payload'->>'connectionId' = ${connectionId}`;
    expect(Number(jobs[0].n)).toBeGreaterThan(0);
  });
});
