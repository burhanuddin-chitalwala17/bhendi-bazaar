// The jobs behind the worker card's counts (worker-foundation R5): a queue row reads as its type,
// state and timing, and a failed one carries the reason pg-boss recorded, cut to a line.
import { describe, expect, it } from "vitest";
import { toJobSummary, type JobRow } from "@server/shared/jobs/jobs.service";

const row = (over: Partial<JobRow> = {}): JobRow => ({
  id: "j1",
  name: "jobs",
  state: "completed",
  data: { type: "media.sweep", payload: {} },
  retry_count: 0,
  created_on: new Date("2026-09-27T10:00:00Z"),
  started_on: new Date("2026-09-27T10:00:01Z"),
  completed_on: new Date("2026-09-27T10:00:02Z"),
  output: null,
  ...over,
});

describe("toJobSummary", () => {
  it("reads the type out of the envelope and puts the times on the wire as ISO", () => {
    expect(toJobSummary(row())).toEqual({
      id: "j1",
      type: "media.sweep",
      queue: "jobs",
      state: "completed",
      createdAt: "2026-09-27T10:00:00.000Z",
      startedAt: "2026-09-27T10:00:01.000Z",
      completedAt: "2026-09-27T10:00:02.000Z",
      attempts: 0,
      error: null,
    });
  });

  it("a failed job carries pg-boss's message, cut to a line; a completed one carries no error even with output", () => {
    expect(toJobSummary(row({ state: "failed", output: { message: "boom", stack: "..." } })).error).toBe("boom");
    expect(toJobSummary(row({ state: "failed", output: "x".repeat(500) })).error).toHaveLength(200);
    expect(toJobSummary(row({ state: "failed", output: { code: 7 } })).error).toBe('{"code":7}');
    expect(toJobSummary(row({ state: "completed", output: { message: "fine" } })).error).toBeNull();
  });

  it("an envelope without a type, and a job never started, still read", () => {
    const summary = toJobSummary(row({ data: {}, started_on: null, completed_on: null, state: "created", name: "jobs_failed", retry_count: 2 }));
    expect(summary).toMatchObject({ type: "unknown", startedAt: null, completedAt: null, attempts: 2, queue: "jobs_failed" });
  });
});
