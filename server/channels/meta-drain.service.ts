import { randomUUID } from "node:crypto";
import { decryptSecret } from "@server/shared/crypto";
import { enqueueLater } from "@server/shared/jobs/jobs.enqueue";
import { prisma } from "@server/shared/prisma";
import type { FactKind, SocialFact } from "@server/shared/social-events/facts";
import { PermanentFactError, sinksFor } from "@server/shared/social-events/sinks";
import { connectionLaneRepository, LANE } from "./connection-lane.repository";
import { metaEventRepository, type PendingEvent } from "./meta-event.repository";
import { META_EVENT_STATE } from "./meta-event.types";
import { drainEventsSpec } from "./meta-drain.job";
import { translateEvent } from "./providers/meta/translate";
import type { SocialPlatform } from "./social/types";

/**
 * A connection's stored events turned into facts and handed to their sinks in the order they
 * happened, one drain per account at a time (ADR-0078 decisions 3–4; meta-foundation D4, D5).
 */

const BATCH = 500;
/** Bounded so one hot shop's run yields the worker; it asks for another while events remain. */
const ROUNDS_PER_RUN = 10;
const LEASE_SECONDS = 60;
/** A drain that finds the lane held looks again after this, in case the holder had already checked. */
const BUSY_RETRY_SECONDS = 5;
/** After a sink outage: 30 s, doubling, at most 15 minutes. */
const outageDelay = (retries: number) => Math.min(30 * 2 ** Math.max(0, retries - 1), 900);

export interface DrainResult {
  claimed: boolean;
  handed: number;
  dead: number;
  /** Whether events remain, and how soon to look again. */
  retryAfterSeconds: number | null;
}

/** The event cannot ever become facts (it does not decrypt or parse): poison, counted toward dead. */
class UnreadableEventError extends Error {
  constructor(cause: unknown) {
    super("A stored Meta event could not be read", { cause });
    this.name = "UnreadableEventError";
  }
}

function factsOf(event: PendingEvent): SocialFact[] {
  let payload: unknown;
  try {
    payload = JSON.parse(decryptSecret(event.sealedPayload));
  } catch (error) {
    throw new UnreadableEventError(error);
  }
  return translateEvent({
    key: event.dedupeKey,
    connectionId: event.connectionId,
    product: event.product as SocialPlatform,
    field: event.field,
    occurredAt: event.occurredAt,
    payload,
  });
}

const isPoison = (error: unknown) => error instanceof UnreadableEventError || error instanceof PermanentFactError;
const errorCode = (error: unknown) => ((error as Error | null)?.name ?? "Error").slice(0, 60);

export const metaDrainService = {
  async drain(connectionId: string, holder: string = randomUUID()): Promise<DrainResult> {
    const hold = () => connectionLaneRepository.claim(connectionId, LANE.EVENTS, holder, LEASE_SECONDS);
    if (!(await hold())) return { claimed: false, handed: 0, dead: 0, retryAfterSeconds: BUSY_RETRY_SECONDS };

    /**
     * Hands each fact to the sinks of its kind, consecutive facts of one kind together, renewing the
     * lease before every hand-over: once it is lost, nothing more is handed or written.
     */
    const handOn = async (facts: readonly SocialFact[]): Promise<boolean> => {
      let start = 0;
      while (start < facts.length) {
        const kind: FactKind = facts[start].kind;
        let end = start;
        while (end < facts.length && facts[end].kind === kind) end++;
        for (const sink of sinksFor(kind)) {
          if (!(await hold())) return false;
          await sink.handle(facts.slice(start, end) as never);
        }
        start = end;
      }
      return hold();
    };

    let handed = 0;
    let dead = 0;
    let retryAfterSeconds: number | null = null;
    let leaseLost = false;
    try {
      rounds: for (let round = 0; round < ROUNDS_PER_RUN; round++) {
        const events = await metaEventRepository.pending(connectionId, BATCH);
        if (events.length === 0) break;

        // Fast path: the whole batch in order. If it fails, it is replayed one event at a time to find
        // the event at fault; sinks are idempotent on each fact's key, so the replay repeats nothing.
        try {
          if (!(await handOn(events.flatMap(factsOf)))) {
            leaseLost = true;
            break;
          }
          await metaEventRepository.markDone(events.map((e) => e.id), new Date());
          handed += events.length;
          continue;
        } catch {
          // Fall through to one at a time.
        }

        for (const event of events) {
          try {
            if (!(await handOn(factsOf(event)))) {
              leaseLost = true;
              break rounds;
            }
            await metaEventRepository.markDone([event.id], new Date());
            handed += 1;
          } catch (error) {
            const log = { scope: "meta.drain", connectionId, eventId: event.id, field: event.field, error: errorCode(error) };
            if (isPoison(error)) {
              const state = await metaEventRepository.markFailed(event.id, errorCode(error));
              console.error(JSON.stringify({ ...log, poison: true, state }));
              if (state === META_EVENT_STATE.DEAD) {
                dead += 1;
                continue;
              }
              retryAfterSeconds = outageDelay(1);
            } else {
              const retries = await metaEventRepository.markRetry(event.id, errorCode(error));
              console.error(JSON.stringify({ ...log, poison: false, retries }));
              retryAfterSeconds = outageDelay(retries);
            }
            // Order matters: the run stops here rather than hand on what came after.
            break rounds;
          }
        }
      }
    } finally {
      if (!leaseLost) await connectionLaneRepository.release(connectionId, LANE.EVENTS, holder);
    }
    // Checked after release, so an event stored while we held the lane is never stranded.
    if (!leaseLost && retryAfterSeconds === null && (await metaEventRepository.hasPending(connectionId))) retryAfterSeconds = 0;
    console.info(JSON.stringify({ scope: "meta.drain", connectionId, handed, dead, leaseLost, retryAfterSeconds }));
    return { claimed: true, handed, dead, retryAfterSeconds };
  },

  /**
   * Asks for a drain of this connection. The queue keeps one job per slot per second; when the slot
   * is taken (a job sent in the same second, even one already finished) a spare slot is used, so a
   * request is never silently swallowed.
   */
  async request(connectionId: string, orgId: string, afterSeconds = 0): Promise<boolean> {
    const payload = { connectionId, orgId };
    if (await enqueueLater(prisma, drainEventsSpec, payload, { afterSeconds, onePerSeconds: 1, slot: connectionId })) return true;
    if (await enqueueLater(prisma, drainEventsSpec, payload, { afterSeconds: afterSeconds + 1, onePerSeconds: 1, slot: `${connectionId}:spare` })) {
      return true;
    }
    console.error(JSON.stringify({ scope: "meta.drain", connectionId, error: "request-not-queued" }));
    return false;
  },
};
