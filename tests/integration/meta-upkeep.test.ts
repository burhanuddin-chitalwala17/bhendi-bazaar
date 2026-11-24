/**
 * Meta's daily upkeep against a real database (meta-foundation unit 5, R11, D10): raw events past 30
 * days deleted in batches and nothing newer; a drain a lost job left waiting asked again; a deletion
 * request pending past a day queued again.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";

const RUN = Date.now();
const DAY = 86_400_000;

describe.skipIf(!isDisposableDb)("Meta upkeep (local db)", () => {
  let connectionId = "";
  let orgId = "";

  beforeAll(async () => {
    const { prisma } = await import("@server/shared/prisma");
    ({ orgId } = await ensureFixtures());
    await prisma.channelConnection.deleteMany({ where: { orgId, channel: "instagram" } });
    connectionId = (
      await prisma.channelConnection.create({
        data: { orgId, channel: "instagram", state: "CONNECTED", accessToken: "sealed-placeholder", externalAccountId: `UPKEEP-${RUN}` },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    const { prisma } = await import("@server/shared/prisma");
    await prisma.channelConnection.deleteMany({ where: { id: connectionId } });
    await prisma.dataDeletionRequest.deleteMany({ where: { code: { startsWith: "UPK" } } });
  });

  const events = (n: number, receivedAt: Date, prefix: string, state = "DONE") =>
    Array.from({ length: n }, (_, i) => ({
      product: "instagram",
      field: "comments",
      connectionId,
      externalAccountId: `UPKEEP-${RUN}`,
      dedupeKey: `${prefix}-${RUN}-${i}`,
      occurredAt: receivedAt,
      receivedAt,
      state,
      sealedPayload: "sealed",
    }));

  it("R11: deletes every event past 30 days, in batches, and nothing newer", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { metaUpkeepService } = await import("@server/channels/meta-upkeep.service");
    const now = new Date();
    await prisma.metaEvent.createMany({
      data: [...events(1_005, new Date(now.getTime() - 31 * DAY), "old"), ...events(2, new Date(now.getTime() - 31 * DAY), "lost", "PENDING"), ...events(3, new Date(now.getTime() - 29 * DAY), "young")],
    });
    const day = (ms: number) => new Date(now.getTime() - ms).toISOString().slice(0, 10);
    await prisma.$executeRawUnsafe(`INSERT INTO "MetaUnroutedCount" ("day", "product", "unrouted") VALUES ('${day(401 * DAY)}', 'instagram', 1), ('${day(399 * DAY)}', 'instagram', 1) ON CONFLICT DO NOTHING`);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const outcome = await metaUpkeepService.retention(now, 0);
    expect(outcome.events).toBeGreaterThanOrEqual(1_007);
    expect(outcome.unhanded).toBeGreaterThanOrEqual(2);
    expect(await prisma.metaUnroutedCount.count({ where: { day: new Date(day(401 * DAY)) } })).toBe(0);
    expect(await prisma.metaUnroutedCount.count({ where: { day: new Date(day(399 * DAY)) } })).toBe(1);
    expect(await prisma.metaEvent.count({ where: { connectionId, dedupeKey: { startsWith: `old-${RUN}` } } })).toBe(0);
    expect(await prisma.metaEvent.count({ where: { connectionId, dedupeKey: { startsWith: `young-${RUN}` } } })).toBe(3);
    await prisma.metaEvent.deleteMany({ where: { connectionId } });
  });

  it("asks again for a drain whose events still wait, and only that one", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { metaUpkeepService } = await import("@server/channels/meta-upkeep.service");
    const { metaDrainService } = await import("@server/channels/meta-drain.service");
    const asked = vi.spyOn(metaDrainService, "request").mockResolvedValue(true);
    const now = new Date();
    await prisma.metaEvent.createMany({ data: events(1, new Date(now.getTime() - 3_600_000), "fresh", "PENDING") });
    expect((await metaUpkeepService.sweep(new Date(now.getTime() - 3_590_000))).drains).toBe(0);
    await metaUpkeepService.sweep(now);
    expect(asked).toHaveBeenCalledWith(connectionId, orgId);
    asked.mockRestore();
    await prisma.metaEvent.deleteMany({ where: { connectionId } });
  });

  it("queues again a deletion request still pending after a day, never a done one", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { metaUpkeepService } = await import("@server/channels/meta-upkeep.service");
    const { JOBS_QUEUE, JOBS_SCHEMA } = await import("@server/shared/jobs/jobs.config");
    const old = new Date(Date.now() - 2 * DAY);
    const stuck = await prisma.dataDeletionRequest.create({ data: { code: `UPKA${RUN}`.slice(0, 12), product: "whatsapp", userIdHash: "h", sealedUserId: "s", requestedAt: old } });
    const done = await prisma.dataDeletionRequest.create({ data: { code: `UPKB${RUN}`.slice(0, 12), product: "whatsapp", userIdHash: "h", sealedUserId: "", state: "DONE", requestedAt: old } });
    await metaUpkeepService.sweep();
    const queued = async (id: string) =>
      Number(
        (
          await prisma.$queryRawUnsafe<{ n: bigint }[]>(
            `SELECT count(*)::bigint AS n FROM ${JOBS_SCHEMA}.job WHERE name = $1 AND data->>'type' = 'channels.delete-person' AND data->'payload'->>'requestId' = $2`,
            JOBS_QUEUE,
            id,
          )
        )[0].n,
      );
    expect(await queued(stuck.id)).toBe(1);
    expect(await queued(done.id)).toBe(0);
  });
});
