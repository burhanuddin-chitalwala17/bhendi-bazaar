/**
 * One new job wakes one of the worker's loops, not all of them: each wake is a fetch, a billed
 * statement, and pg-boss wakes every loop on the queue (measured locally: 8 statements per job
 * before, 4 after). The override reaches into pg-boss, so this also fails if an upgrade moves what
 * it relies on: the listener calling `notifyQueue`, and workers kept in a `workers` map by id.
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Manager from "pg-boss/dist/manager.js";
import { startWorkLoops, wakeOneLoopPerJob } from "@server/shared/jobs/jobs.work";

const PG_BOSS = resolve(__dirname, "../../node_modules/pg-boss/dist");

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

  it("wakes one loop on the queue, not every one", () => {
    wakeOneLoopPerJob();
    const workers = loops(["jobs", "jobs", "jobs", "jobs", "other"]);
    (Manager.prototype as unknown as { notifyQueue(this: unknown, name: string): void }).notifyQueue.call(
      { workers: new Map(workers.map((w) => [w.id, w])) },
      "jobs",
    );
    expect(workers.filter((w) => w.notify.mock.calls.length > 0)).toHaveLength(1);
    expect(workers[4].notify).not.toHaveBeenCalled();
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

  it("an empty fetch wakes no one", async () => {
    const handlers: Array<(jobs: unknown[]) => Promise<void>> = [];
    const notifyWorker = vi.fn();
    await startWorkLoops({ work: async (_q: string, _o: unknown, h: (typeof handlers)[number]) => (handlers.push(h), `l${handlers.length}`), notifyWorker } as never, "jobs", async () => {}, 4);
    await handlers[0]([]);
    expect(notifyWorker).not.toHaveBeenCalled();
  });
});
