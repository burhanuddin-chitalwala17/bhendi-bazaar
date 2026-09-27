/**
 * A request against the real schema and the real queue (image-enhancement trd D1, D5; ADR-0038
 * D2): the ledger row and its `image.enhance` job exist together after `request`, and neither after
 * a transaction that rolled back; an org with no policy row reads the declared defaults, and a
 * pause is honoured by the next request. The store is stubbed — no bucket is reached — and the
 * suite owns its fixtures.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { isDisposableDb, ensureFixtures } from "../helpers/test-db";
import { JOBS_QUEUE, JOBS_SCHEMA } from "@server/shared/jobs/jobs.config";
import { DEFAULT_MONTHLY_ALLOWANCE } from "@server/content/enhancement.types";

vi.mock("@server/catalog/object-store", () => ({
  headObject: vi.fn(),
  getObject: vi.fn(),
  putObject: vi.fn(),
  deleteObject: vi.fn(),
  presignUpload: vi.fn(),
  publicUrlFor: (key: string) => `https://media.test/${key}`,
  pathnameFor: (url: string) => url.replace("https://media.test/", ""),
  isOwnObjectUrl: (url: string) => url.startsWith("https://media.test/"),
}));

describe.skipIf(!isDisposableDb)("an enhancement request writes its row and its job together (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let service: typeof import("@server/content/enhancement.service").enhancementService;
  let repo: typeof import("@server/content/enhancement.repository").enhancementRepository;
  let policies: typeof import("@server/content/enhancement-policy.repository").enhancementPolicyRepository;
  let enqueue: typeof import("@server/shared/jobs").enqueue;
  let spec: typeof import("@server/content/enhancement.job").enhancementSpec;
  const stamp = Date.now().toString(36);
  const enhancements: string[] = [];
  const assets: string[] = [];
  let orgId: string;
  let userId: string;
  let sourceRef: string;
  let hadPolicy = false;

  const jobsFor = async (enhancementId: string) => {
    const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*)::bigint AS n FROM ${JOBS_SCHEMA}.job WHERE name = $1 AND data->>'type' = 'image.enhance' AND data->'payload'->>'enhancementId' = $2`,
      JOBS_QUEUE,
      enhancementId,
    );
    return Number(rows[0].n);
  };

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ enhancementService: service } = await import("@server/content/enhancement.service"));
    ({ enhancementRepository: repo } = await import("@server/content/enhancement.repository"));
    ({ enhancementPolicyRepository: policies } = await import("@server/content/enhancement-policy.repository"));
    ({ enqueue } = await import("@server/shared/jobs"));
    ({ enhancementSpec: spec } = await import("@server/content/enhancement.job"));
    const { mediaAssetRepository } = await import("@server/catalog/media-asset.repository");
    ({ orgId, userId } = await ensureFixtures());
    hadPolicy = (await prisma.orgEnhancementPolicy.findUnique({ where: { orgId } })) !== null;

    const objectKey = `${stamp}/dark.webp`;
    sourceRef = `https://media.test/${objectKey}`;
    const photo = await mediaAssetRepository.createReady({
      orgId,
      uploaderId: userId,
      ref: sourceRef,
      objectKey,
      mimeType: "image/webp",
      bytes: 1234,
      width: 1600,
      height: 1200,
    });
    assets.push(photo.id);
  });

  afterAll(async () => {
    for (const id of enhancements) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM ${JOBS_SCHEMA}.job WHERE name = $1 AND data->'payload'->>'enhancementId' = $2`,
        JOBS_QUEUE,
        id,
      );
    }
    await prisma.enhancement.deleteMany({ where: { id: { in: enhancements } } });
    await prisma.mediaAsset.deleteMany({ where: { id: { in: assets } } });
    // The fixture org is shared with other suites: leave its policy exactly as it was found.
    if (!hadPolicy) await prisma.orgEnhancementPolicy.deleteMany({ where: { orgId } });
    else await policies.resume(orgId);
  });

  it("writes a REQUESTED row and one image.enhance job for it, from the URL the gallery row carries", async () => {
    const { enhancement, usage } = await service.request(orgId, userId, {
      tool: "LIGHT",
      sourceRef,
      slot: "front",
      slotRole: "product",
    });
    enhancements.push(enhancement.id);

    expect(enhancement).toMatchObject({ state: "REQUESTED", tool: "LIGHT", sourceAssetId: assets[0], sourceRef, proposalUrl: null, costPaise: 0 });
    expect(await repo.findById(enhancement.id)).toMatchObject({ orgId, requesterId: userId, provider: "sharp", slot: "front" });
    expect(await jobsFor(enhancement.id)).toBe(1);
    expect(usage.used).toBeGreaterThanOrEqual(1);
    expect(await repo.countUsage(orgId, { start: new Date(0), end: new Date(Date.now() + 60_000) })).toBeGreaterThanOrEqual(1);
  });

  it("leaves neither a row nor a job when the transaction rolls back", async () => {
    let id = "";
    await expect(
      prisma.$transaction(async (tx) => {
        const created = await repo.create(
          { orgId, requesterId: userId, sourceAssetId: assets[0], tool: "LIGHT", preset: null, provider: "sharp", slot: null },
          tx,
        );
        id = created.id;
        await enqueue(tx, spec, { enhancementId: created.id, orgId });
        throw new Error("roll back");
      }),
    ).rejects.toThrow("roll back");

    expect(id).not.toBe("");
    expect(await repo.findById(id)).toBeNull();
    expect(await jobsFor(id)).toBe(0);
  });

  it("reads the declared defaults for an org with no policy row", async () => {
    await expect(policies.policyFor(`no-such-org-${stamp}`)).resolves.toEqual({
      monthlyAllowance: DEFAULT_MONTHLY_ALLOWANCE,
      pausedAt: null,
      pauseReason: null,
    });
  });

  it("honours a pause on the next request, and lifts it", async () => {
    await policies.pause(orgId, "Unpaid invoice");
    await expect(service.request(orgId, userId, { tool: "LIGHT", sourceRef })).rejects.toThrow(
      "Enhancement is paused for your shop: Unpaid invoice",
    );

    await policies.resume(orgId);
    const { enhancement } = await service.request(orgId, userId, { tool: "LIGHT", sourceRef });
    enhancements.push(enhancement.id);
    expect(enhancement.state).toBe("REQUESTED");
  });
});
