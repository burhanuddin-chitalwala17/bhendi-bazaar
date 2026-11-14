/**
 * The locks hold where the work is done, not only on a screen (subscriptions/feature-access spec A1,
 * A2, A5; D5, D6, D8). A shop with no switches is refused by every channel action and by enhancement,
 * its background work ends quietly, and the check costs one statement per org request.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi, type MockInstance } from "vitest";

import { isDisposableDb, ensureFixtures } from "../helpers/test-db";

process.env.PRISMA_LOG_QUERIES = "1";

describe.skipIf(!isDisposableDb)("feature enforcement (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let FeatureLockedError: typeof import("@server/shared/domain-error").FeatureLockedError;
  let access: typeof import("@server/subscriptions/feature-access.service").featureAccessService;
  let FEATURE: typeof import("@server/subscriptions/feature-access.types").FEATURE;

  const stamp = `fe${Date.now().toString(36)}`;
  let lockedOrg: string;
  let adminId: string;
  let queries = 0;
  let spy: MockInstance;

  beforeAll(async () => {
    spy = vi.spyOn(console, "log").mockImplementation((...args) => {
      if (typeof args[0] === "string" && args[0].startsWith("prisma:query")) queries++;
    });
    ({ prisma } = await import("@server/shared/prisma"));
    ({ FeatureLockedError } = await import("@server/shared/domain-error"));
    ({ featureAccessService: access } = await import("@server/subscriptions/feature-access.service"));
    ({ FEATURE } = await import("@server/subscriptions/feature-access.types"));
    ({ userId: adminId } = await ensureFixtures());
    lockedOrg = (
      await prisma.org.create({
        data: { code: `${stamp}`, handle: `${stamp}`, name: "Locked shop", email: `${stamp}@example.invalid` },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    spy?.mockRestore();
    await prisma.adminLog.deleteMany({ where: { resourceId: lockedOrg } });
    await prisma.org.deleteMany({ where: { id: lockedOrg } });
  });

  // A table, so a method added to the list without its check fails here (TRD test plan, D5 sweep).
  it("refuses every channel action for a shop without Channels (spec A1, D5)", async () => {
    const { channelConnectionService } = await import("@server/channels/channel-connection.service");
    const { channelImportService } = await import("@server/channels/channel-import.service");
    const { channelSettleService } = await import("@server/channels/channel-settle.service");
    const { channelFactsService } = await import("@server/channels/channel-facts.service");
    const { channelFamilyService } = await import("@server/channels/channel-family.service");
    const { channelLocationService } = await import("@server/channels/channel-location.service");
    const { channelStockService } = await import("@server/channels/channel-stock.service");
    const { listingPublishService } = await import("@server/channels/listing-publish.service");
    const { listingCreateService } = await import("@server/channels/listing-create.service");
    const { platformListingService } = await import("@server/channels/platform-listing.service");
    const o = lockedOrg;
    const calls: Array<[string, () => Promise<unknown>]> = [
      ["startConnect", () => channelConnectionService.startConnect(o, adminId, "amazon")],
      ["check", () => channelConnectionService.check(o, "amazon")],
      ["requestRead", () => channelImportService.requestRead(o, "amazon")],
      ["leaveOff", () => channelImportService.leaveOff(o, adminId, "x")],
      ["dismissFamilyHint", () => channelImportService.dismissFamilyHint(o, ["x"])],
      ["bringBack", () => channelImportService.bringBack(o, "x")],
      ["unlink", () => channelImportService.unlink(o, adminId, "x")],
      ["linkBack", () => channelImportService.linkBack(o, "x")],
      ["settle", () => channelSettleService.settle(o, adminId, { listingIds: ["x"] } as never)],
      ["retryPhotos", () => channelSettleService.retryPhotos(o, "x")],
      ["fillNow", () => channelFactsService.fillNow(o, "x")],
      ["change", () => channelFactsService.change(o, "x", { action: "fill" } as never)],
      ["familySettle", () => channelFamilyService.settle(o, adminId, { listingIds: [], members: [] } as never)],
      ["locationSave", () => channelLocationService.save(o, "amazon", [])],
      ["turnOn", () => channelStockService.turnOn(o, "amazon")],
      ["publish", () => listingPublishService.publish(o, "amazon", [])],
      ["publishProducts", () => listingPublishService.publishProducts(o, "amazon", [])],
      ["findPages", () => listingCreateService.findPages(o, "x", "amazon")],
      ["startDraft", () => listingCreateService.startDraft(o, "x", "amazon", { mode: "new", targetExternalId: null } as never)],
      ["startFamily", () => listingCreateService.startFamily(o, "x", "amazon")],
      ["complaint", () => platformListingService.complaint(o, "x", "amazon")],
    ];
    const notRefused: string[] = [];
    for (const [name, call] of calls) {
      const error = await call().then(() => null, (e: unknown) => e);
      if (!(error instanceof FeatureLockedError)) notRefused.push(name);
    }
    expect(notRefused).toEqual([]);
  });

  it("refuses a new enhancement before any slot is spent (spec A5, D5)", async () => {
    const { enhancementService } = await import("@server/content/enhancement.service");
    const before = await prisma.enhancement.count({ where: { orgId: lockedOrg } });
    await expect(
      enhancementService.request(lockedOrg, adminId, { tool: "light", sourceAssetId: "x" } as never),
    ).rejects.toBeInstanceOf(FeatureLockedError);
    expect(await prisma.enhancement.count({ where: { orgId: lockedOrg } })).toBe(before);
  });

  it("ends a locked shop's channel job succeeded with a skip, never thrown (spec A2, D8)", async () => {
    const { publishListingJob, listingReadJob, listingFactsJob, listingPhotosJob } = await import("@server/channels/channels.jobs");
    const { listingPublishService } = await import("@server/channels/listing-publish.service");
    const { channelImportService } = await import("@server/channels/channel-import.service");
    const { channelFactsService } = await import("@server/channels/channel-facts.service");
    const { channelSettleService } = await import("@server/channels/channel-settle.service");
    // The work itself must never be reached for a locked shop, so every one of these spies must stay silent.
    const send = vi.spyOn(listingPublishService, "send");
    const read = vi.spyOn(channelImportService, "runRead");
    const facts = vi.spyOn(channelFactsService, "run");
    const photos = vi.spyOn(channelSettleService, "copyPhotos");
    const payload = { listingId: "x", connectionId: "x", productId: "x", orgId: lockedOrg } as never;
    await expect(publishListingJob.handler({ jobId: "t1", payload })).resolves.toBeUndefined();
    await expect(listingReadJob.handler({ jobId: "t2", payload })).resolves.toBeUndefined();
    await expect(listingFactsJob.handler({ jobId: "t3", payload })).resolves.toBeUndefined();
    await expect(listingPhotosJob.handler({ jobId: "t4", payload })).resolves.toBeUndefined();
    for (const spy of [send, read, facts, photos]) {
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    }
  });

  // The free paths, held open: a lock must never trap a credential, stop a pause, or take a made proposal (Q11, Q12, Q32).
  it("never locks what stays free for a shop without the features (spec A1, D5)", async () => {
    const { channelConnectionService } = await import("@server/channels/channel-connection.service");
    const { channelStockService } = await import("@server/channels/channel-stock.service");
    const { enhancementService } = await import("@server/content/enhancement.service");
    const { platformListingService } = await import("@server/channels/platform-listing.service");
    const o = lockedOrg;
    const calls: Array<[string, () => Promise<unknown>]> = [
      ["disconnect", () => channelConnectionService.disconnect(o, adminId, "amazon")],
      ["overview", () => channelConnectionService.overview(o)],
      ["pause", () => channelStockService.pause(o, "amazon")],
      ["accept", () => enhancementService.accept(o, "x")],
      ["discard", () => enhancementService.discard(o, "x")],
      ["listingSave", () => platformListingService.save(o, "x", "amazon", { seenVersion: 0, overrides: {} } as never)],
    ];
    const locked: string[] = [];
    for (const [name, call] of calls) {
      const error = await call().then(() => null, (e: unknown) => e);
      if (error instanceof FeatureLockedError) locked.push(name);
    }
    expect(locked).toEqual([]);
  });

  it("keeps renewing a locked shop's tokens, and never health-checks it (Q11, D5)", async () => {
    const { channelConnectionService } = await import("@server/channels/channel-connection.service");
    const check = vi.spyOn(channelConnectionService, "checkConnection").mockResolvedValue("ok");
    const row = { id: "c1", orgId: lockedOrg, channel: "amazon", state: "CONNECTED", refreshToken: null, refreshTokenExpiresAt: null, accessToken: null, accessTokenExpiresAt: null };
    const summary = { checked: 0, renewed: 0, resealed: 0, needsReconnect: 0, unreachable: 0, skipped: 0, locked: 0 };
    await channelConnectionService.maintainOne(row as never, async () => false, summary, new Date(), false).catch(() => undefined);
    expect(check).not.toHaveBeenCalled();
    expect(summary.locked).toBe(1);
    await channelConnectionService.maintainOne(row as never, async () => false, summary, new Date(), true).catch(() => undefined);
    expect(check).toHaveBeenCalledOnce();
    check.mockRestore();
  });

  it("lets the shop act once the admin switches Channels on, with no reconnect (Q11, Q17)", async () => {
    await access.set(adminId, lockedOrg, FEATURE.CHANNELS, true);
    const { channelImportService } = await import("@server/channels/channel-import.service");
    // Past the lock, the next refusal is the missing listing, not the plan.
    const error = await channelImportService.bringBack(lockedOrg, "x").then(() => null, (e: unknown) => e);
    expect(error).not.toBeInstanceOf(FeatureLockedError);
    await access.set(adminId, lockedOrg, FEATURE.CHANNELS, false);
  });

  it("costs one statement per org request for the features (D6)", async () => {
    queries = 0;
    await access.forOrg(lockedOrg);
    expect(queries).toBe(1);
  });
});
