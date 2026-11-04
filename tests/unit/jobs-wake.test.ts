/** One new job wakes one worker loop, not all (worker-foundation trd.md D3); fails too if pg-boss moves what that relies on. */
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Manager from "pg-boss/dist/manager.js";
import { startWorkLoops, wakeOneLoopPerJob } from "@server/shared/jobs/jobs.work";

const PG_BOSS = resolve(__dirname, "../../node_modules/pg-boss/dist");
const busy = () => ((globalThis as unknown as Record<symbol, Set<string>>)[Symbol.for("bhendi-bazaar.jobs-busy")] ??= new Set());
const notifyQueue = (workers: Array<{ id: string; name: string; notify: () => void }>) =>
  (Manager.prototype as unknown as { notifyQueue(this: unknown, name: string): void }).notifyQueue.call(
    { workers: new Map(workers.map((w) => [w.id, w])) },
    "jobs",
  );

describe("pg-boss still has the shape the wake rule relies on", () => {
  it("the listener wakes a queue through notifyQueue, and workers live in a map with name, id and notify", () => {
    expect(readFileSync(resolve(PG_BOSS, "notifier.js"), "utf8")).toMatch(/this\.#manager\.notifyQueue\(payload\)/);
    const manager = readFileSync(resolve(PG_BOSS, "manager.js"), "utf8");
    expect(manager).toMatch(/notifyQueue\(name\) \{/);
    expect(manager).toMatch(/this\.workers\.set\(/);
    const worker = readFileSync(resolve(PG_BOSS, "worker.js"), "utf8");
    expect(worker).toMatch(/\bnotify\(\) \{/);
  });
});

describe("wake rule", () => {
  const loops = (names: string[]) => names.map((name, i) => ({ id: `w${i}`, name, notify: vi.fn() }));

  it("wakes one loop on the queue, not every one, and an idle one before a busy one", () => {
    wakeOneLoopPerJob();
    const workers = loops(["jobs", "jobs", "jobs", "jobs", "other"]);
    busy().add("w0");
    try {
      notifyQueue(workers);
    } finally {
      busy().delete("w0");
    }
    expect(workers.filter((w) => w.notify.mock.calls.length > 0).map((w) => w.id)).toEqual(["w1"]);
  });

  it("with every loop busy, still wakes one, which looks again when its job ends", () => {
    wakeOneLoopPerJob();
    const workers = loops(["jobs", "jobs"]);
    workers.forEach((w) => busy().add(w.id));
    try {
      notifyQueue(workers);
    } finally {
      workers.forEach((w) => busy().delete(w.id));
    }
    expect(workers.filter((w) => w.notify.mock.calls.length > 0)).toHaveLength(1);
  });

  it("a loop that takes a job wakes one idle sibling, so a burst still spreads", async () => {
    const handlers: Array<(jobs: Array<{ id: string; data: unknown }>) => Promise<void>> = [];
    const notifyWorker = vi.fn();
    const boss = {
      work: vi.fn(async (_q: string, _o: unknown, handler: (typeof handlers)[number]) => {
        handlers.push(handler);
        return `loop-${handlers.length - 1}`;
      }),
      notifyWorker,
    };
    let release!: () => void;
    const running = new Promise<void>((r) => (release = r));
    await startWorkLoops(boss as never, "jobs", async () => running, 4);

    const first = handlers[0]([{ id: "a", data: {} }]);
    expect(notifyWorker.mock.calls.map((c) => c[0])).toEqual(["loop-1"]);
    release();
    await first;
    expect(notifyWorker.mock.calls.at(-1)?.[0]).toBe("loop-0"); // and looks again itself once done
  });

  it("a job that throws leaves its loop idle again", async () => {
    const handlers: Array<(jobs: Array<{ id: string; data: unknown }>) => Promise<void>> = [];
    await startWorkLoops({ work: async (_q: string, _o: unknown, h: (typeof handlers)[number]) => (handlers.push(h), `t${handlers.length}`), notifyWorker: vi.fn() } as never, "jobs", async () => {
      throw new Error("handler failed");
    }, 2);
    await expect(handlers[0]([{ id: "a", data: {} }])).rejects.toThrow("handler failed");
    expect(busy().has("t1")).toBe(false);
  });

  it("an empty fetch wakes no one", async () => {
    const handlers: Array<(jobs: unknown[]) => Promise<void>> = [];
    const notifyWorker = vi.fn();
    await startWorkLoops({ work: async (_q: string, _o: unknown, h: (typeof handlers)[number]) => (handlers.push(h), `l${handlers.length}`), notifyWorker } as never, "jobs", async () => {}, 4);
    await handlers[0]([]);
    expect(notifyWorker).not.toHaveBeenCalled();
  });
});
