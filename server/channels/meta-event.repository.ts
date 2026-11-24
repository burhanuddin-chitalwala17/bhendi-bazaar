import { prisma } from "@server/shared/prisma";
import { META_EVENT_STATE, type MetaEventState } from "./meta-event.types";

/** The one way to reach `MetaEvent` (Invariant 5). Payloads arrive here already sealed. */

export interface NewMetaEvent {
  product: string;
  field: string;
  connectionId: string;
  externalAccountId: string;
  dedupeKey: string;
  occurredAt: Date;
  sealedPayload: string;
}

export interface PendingEvent {
  id: string;
  product: string;
  field: string;
  connectionId: string;
  dedupeKey: string;
  occurredAt: Date;
  sealedPayload: string;
  attempts: number;
  retries: number;
}

/** After this many failed hand-overs an event is dead and skipped (ADR-0084 decision 3). */
export const META_EVENT_MAX_ATTEMPTS = 5;

export const metaEventRepository = {
  /** Writes each event once; a redelivered key is skipped (`ON CONFLICT DO NOTHING`). Answers how many were new. */
  async storeOnce(events: readonly NewMetaEvent[]): Promise<number> {
    if (events.length === 0) return 0;
    const { count } = await prisma.metaEvent.createMany({ data: [...events], skipDuplicates: true });
    return count;
  },

  /** A connection's pending events in the order they happened, for the drain (the partial pending index). */
  async pending(connectionId: string, limit: number): Promise<PendingEvent[]> {
    return await prisma.metaEvent.findMany({
      where: { connectionId, state: META_EVENT_STATE.PENDING },
      orderBy: [{ occurredAt: "asc" }, { seq: "asc" }],
      take: limit,
      select: { id: true, product: true, field: true, connectionId: true, dedupeKey: true, occurredAt: true, sealedPayload: true, attempts: true, retries: true },
    });
  },

  async markDone(ids: readonly string[], now: Date): Promise<void> {
    if (ids.length === 0) return;
    await prisma.metaEvent.updateMany({
      where: { id: { in: [...ids] }, state: META_EVENT_STATE.PENDING },
      data: { state: META_EVENT_STATE.DONE, processedAt: now },
    });
  },

  /** Counts one failed hand-over in one statement; the fifth makes it dead. Answers the state it is left in. */
  async markFailed(id: string, errorCode: string): Promise<MetaEventState> {
    const rows = await prisma.$queryRaw<Array<{ state: MetaEventState }>>`
      UPDATE "MetaEvent"
      SET "attempts" = "attempts" + 1,
          "lastErrorCode" = ${errorCode},
          "state" = CASE WHEN "attempts" + 1 >= ${META_EVENT_MAX_ATTEMPTS} THEN ${META_EVENT_STATE.DEAD} ELSE "state" END
      WHERE "id" = ${id} AND "state" = ${META_EVENT_STATE.PENDING}
      RETURNING "state"`;
    return rows[0]?.state ?? META_EVENT_STATE.DONE;
  },

  /** A sink was down: counted apart from attempts, so an outage delays an event and never kills it. */
  async markRetry(id: string, errorCode: string): Promise<number> {
    const rows = await prisma.$queryRaw<Array<{ retries: number }>>`
      UPDATE "MetaEvent" SET "retries" = "retries" + 1, "lastErrorCode" = ${errorCode}
      WHERE "id" = ${id} AND "state" = ${META_EVENT_STATE.PENDING}
      RETURNING "retries"`;
    return rows[0]?.retries ?? 0;
  },

  /**
   * Deletes one batch received before `cutoff`, by the `receivedAt` index (A-D15). Answers how many,
   * and how many of them were never handed on, so that loss is visible rather than silent.
   */
  async deleteReceivedBefore(cutoff: Date, batch: number): Promise<{ deleted: number; unhanded: number }> {
    const rows = await prisma.$queryRaw<Array<{ state: string }>>`
      DELETE FROM "MetaEvent" WHERE "id" IN (
        SELECT "id" FROM "MetaEvent" WHERE "receivedAt" < ${cutoff} ORDER BY "receivedAt" LIMIT ${batch})
      RETURNING "state"`;
    return { deleted: rows.length, unhanded: rows.filter((r) => r.state === META_EVENT_STATE.PENDING).length };
  },

  /** Connections with an event still pending that arrived before `cutoff`: a drain request was lost. */
  async stranded(cutoff: Date): Promise<Array<{ connectionId: string; orgId: string }>> {
    return await prisma.$queryRaw<Array<{ connectionId: string; orgId: string }>>`
      SELECT DISTINCT e."connectionId", c."orgId"
      FROM "MetaEvent" e JOIN "ChannelConnection" c ON c."id" = e."connectionId"
      WHERE e."state" = ${META_EVENT_STATE.PENDING} AND e."receivedAt" < ${cutoff}`;
  },

  async hasPending(connectionId: string): Promise<boolean> {
    const row = await prisma.metaEvent.findFirst({ where: { connectionId, state: META_EVENT_STATE.PENDING }, select: { id: true } });
    return row !== null;
  },
};
