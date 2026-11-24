import { prisma } from "@server/shared/prisma";

/**
 * The one way to reach `ConnectionLane` (Invariant 5): one worker per (connection, lane) at a time
 * (A-D9). Every time is the database's own clock, so workers' clocks never decide who holds a lease.
 */

export const LANE = {
  EVENTS: "events",
  MESSAGES: "messages",
  PUBLISH: "publish",
  CATALOGUE: "catalogue",
  CAMPAIGN: "campaign",
} as const;
export type Lane = (typeof LANE)[keyof typeof LANE];

export const connectionLaneRepository = {
  /**
   * Takes or renews the lease when it is free, expired, or already ours, in one statement, so two
   * workers racing for one lane cannot both win. Answers whether we hold it.
   */
  async claim(connectionId: string, lane: Lane, holder: string, seconds: number): Promise<boolean> {
    const rows = await prisma.$queryRaw<Array<{ holder: string }>>`
      INSERT INTO "ConnectionLane" ("connectionId", "lane", "holder", "leaseUntil")
      VALUES (${connectionId}, ${lane}, ${holder}, timezone('UTC', now()) + make_interval(secs => ${seconds}))
      ON CONFLICT ("connectionId", "lane") DO UPDATE
        SET "holder" = EXCLUDED."holder", "leaseUntil" = EXCLUDED."leaseUntil"
        WHERE "ConnectionLane"."leaseUntil" < timezone('UTC', now()) OR "ConnectionLane"."holder" = ${holder}
      RETURNING "holder"`;
    return rows.length === 1 && rows[0].holder === holder;
  },

  /** Ends our lease; a lease another worker took over is left alone. */
  async release(connectionId: string, lane: Lane, holder: string): Promise<void> {
    await prisma.$executeRaw`
      UPDATE "ConnectionLane" SET "leaseUntil" = timezone('UTC', now())
      WHERE "connectionId" = ${connectionId} AND "lane" = ${lane} AND "holder" = ${holder}`;
  },

  /** Test seam: ends a lease as if its time ran out. */
  async expire(connectionId: string, lane: Lane): Promise<void> {
    await prisma.$executeRaw`
      UPDATE "ConnectionLane" SET "leaseUntil" = timezone('UTC', now()) - interval '1 second'
      WHERE "connectionId" = ${connectionId} AND "lane" = ${lane}`;
  },
};
