import type { JobDefinition, JobEnvelope } from "./jobs.types";
import { JOBS_MAX_SCHEDULES, JOBS_SCHEDULE_MIN_INTERVAL_SECONDS } from "./jobs.config";

/**
 * Recurring work, as an in-process timer that enqueues a job (worker-foundation PR 3's shape,
 * chosen over pg-boss's cron because its 45-second monitor would cost more idle queries than
 * every schedule together — see JOBS_INTERVALS). The timer only *sends*; the work still runs
 * through the queue, so it is retried, visible in admin, and idempotent like any other job.
 *
 * A schedule is a queued singleton: if the last tick's job has not run yet, the next tick
 * adds nothing, so a slow worker never builds a backlog of identical sweeps.
 */
export interface Schedule<T = unknown> {
  definition: JobDefinition<T>;
  payload: T;
  everySeconds: number;
}

const schedules: Schedule[] = [];

export function registerSchedule<T>(definition: JobDefinition<T>, payload: T, everySeconds: number): Schedule<T> {
  if (everySeconds < JOBS_SCHEDULE_MIN_INTERVAL_SECONDS) {
    throw new Error(
      `Schedule "${definition.type}" runs every ${everySeconds}s; the floor is ${JOBS_SCHEDULE_MIN_INTERVAL_SECONDS}s — a tick is a query, and the idle budget counts them`,
    );
  }
  if (schedules.some((schedule) => schedule.definition.type === definition.type)) {
    throw new Error(`Schedule "${definition.type}" is registered twice`);
  }
  if (schedules.length >= JOBS_MAX_SCHEDULES) {
    throw new Error(`More than ${JOBS_MAX_SCHEDULES} schedules; raise JOBS_MAX_SCHEDULES and its place in the idle estimate together`);
  }
  const schedule: Schedule<T> = { definition, payload, everySeconds };
  schedules.push(schedule as Schedule);
  return schedule;
}

export function registeredSchedules(): readonly Schedule[] {
  return schedules;
}

/** What a tick hands the queue: the envelope, keyed so one is ever waiting per schedule. */
export interface ScheduleSend {
  data: JobEnvelope;
  options: { singletonKey: string };
}

export function scheduleSend<T>(schedule: Schedule<T>): ScheduleSend {
  return {
    data: { type: schedule.definition.type, payload: schedule.payload },
    options: { singletonKey: `schedule:${schedule.definition.type}` },
  };
}

/**
 * Start every schedule: one tick now, so a restart never delays a sweep by a whole interval,
 * then one per interval. Returns the function that stops them all.
 */
export function startSchedules(
  send: (send: ScheduleSend) => Promise<unknown>,
  log: (message: string) => void = console.log,
): () => void {
  const timers = schedules.map((schedule) => {
    const tick = async () => {
      try {
        await send(scheduleSend(schedule));
      } catch (error) {
        log(`[jobs] schedule ${schedule.definition.type} could not enqueue: ${error instanceof Error ? error.message : String(error)}`);
      }
    };
    void tick();
    return setInterval(tick, schedule.everySeconds * 1000);
  });
  return () => timers.forEach((timer) => clearInterval(timer));
}

/** Test seam: forget every schedule. */
export function resetSchedules(): void {
  schedules.length = 0;
}
