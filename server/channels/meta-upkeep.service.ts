import { enqueue } from "@server/shared/jobs/jobs.enqueue";
import { prisma } from "@server/shared/prisma";
import { dataDeletionRepository } from "./data-deletion.repository";
import { deletePersonSpec } from "./data-deletion.job";
import { metaDrainService } from "./meta-drain.service";
import { metaEventRepository } from "./meta-event.repository";
import { metaUnroutedRepository } from "./meta-unrouted.repository";

/**
 * The daily upkeep of Meta's events (meta-foundation D10; social-selling A-D10, A-D15): raw events
 * deleted after 30 days (Q2) in batches with a pause, so replication and locks stay light; and a
 * sweep that re-asks whatever a lost job left behind.
 */

const DAY_MS = 86_400_000;
export const EVENT_DAYS = 30;
const COUNT_DAYS = 400;
const BATCH = 1_000;
const PAUSE_MS = 200;
/**
 * Events waiting longer than this lost their drain request: past the drain's longest backoff (15
 * minutes), so a sink outage's own retry is never cut short. Run daily, so a lost drain waits up to
 * a day (Q8).
 */
const STRANDED_MS = 20 * 60 * 1000;
/** The deletion job retries for hours on its own; a request pending past a day is re-queued (Q7). */
const DELETION_STUCK_MS = DAY_MS;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const metaUpkeepService = {
  async retention(now = new Date(), pauseMs = PAUSE_MS): Promise<{ events: number; unhanded: number; counts: number }> {
    const cutoff = new Date(now.getTime() - EVENT_DAYS * DAY_MS);
    let events = 0;
    let unhanded = 0;
    for (;;) {
      const { deleted, unhanded: lost } = await metaEventRepository.deleteReceivedBefore(cutoff, BATCH);
      events += deleted;
      unhanded += lost;
      if (deleted < BATCH) break;
      await pause(pauseMs);
    }
    const counts = await metaUnroutedRepository.deleteBefore(new Date(now.getTime() - COUNT_DAYS * DAY_MS).toISOString().slice(0, 10));
    if (unhanded > 0) console.error(JSON.stringify({ scope: "meta.retention", unhanded }));
    return { events, unhanded, counts };
  },

  async sweep(now = new Date()): Promise<{ drains: number; deletions: number }> {
    const stranded = await metaEventRepository.stranded(new Date(now.getTime() - STRANDED_MS));
    for (const { connectionId, orgId } of stranded) await metaDrainService.request(connectionId, orgId);
    const stuck = await dataDeletionRepository.pendingSince(new Date(now.getTime() - DELETION_STUCK_MS));
    // The job is idempotent: a request already being worked finds itself done, or does the same deletes again.
    for (const requestId of stuck) await enqueue(prisma, deletePersonSpec, { requestId });
    return { drains: stranded.length, deletions: stuck.length };
  },
};
