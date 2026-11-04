/**
 * Publishing a listing against a real schema (marketplace-publish D2–D7). The marketplace is a fake
 * that records what it is sent and answers as told; under test is what we send, what we record, and
 * how the wait for an answer starts and ends.
 */
import "dotenv/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { isDisposableDb, ensureFixtures } from "../helpers/test-db";

// Counted by the answer check's budget test below; every statement is swallowed so the run stays quiet.
process.env.PRISMA_LOG_QUERIES = "1";
let counting = false;
let statements = 0;
vi.spyOn(console, "log").mockImplementation((...args) => {
  if (typeof args[0] === "string" && args[0].startsWith("prisma:query")) {
    if (counting) statements++;
    return;
  }
});

const fake = vi.hoisted(() => {
  const state = {
    published: [] as Array<{ sku: string; changes: Record<string, unknown> }>,
    created: [] as Array<{ sku: string; preview: boolean; family: unknown }>,
    /** Fields the marketplace refuses on the next publish. */
    refuse: new Set<string>(),
    decidesLater: true,
    busy: false,
    previewErrors: false,
    status: { found: true, live: true, issues: [] as unknown[], showing: { title: null as string | null, mainImageUrl: null } },
    /** Thrown by the next status read. */
    statusError: null as Error | null,
    /** Status reads made, each asking for its token first as a real provider does. */
    statusCalls: 0,
  };
  return { state };
});

vi.mock("@server/content/renditions.service", () => ({
  renditionUrl: async (_org: string, assetId: string, surface: string) => `https://cdn.test/${assetId}.${surface}.jpg`,
}));

vi.mock("@server/channels/providers", async () => {
  const { AMAZON_LISTING_RULES, amazonTheirsFromRead } = await import("@server/channels/providers/amazon/amazon.publish");
  const { FLIPKART_LISTING_RULES, flipkartTheirsFromRead } = await import("@server/channels/providers/flipkart/flipkart.publish");
  const { MarketplaceUnavailableError } = await import("@server/channels/providers/marketplace-provider");
  const s = fake.state;
  const common = {
    publishListing: async (_t: unknown, _a: unknown, ref: { sku: string }, changes: Record<string, unknown>) => {
      if (s.busy) throw new MarketplaceUnavailableError(429);
      s.published.push({ sku: ref.sku, changes });
      const sent = Object.keys(changes).filter((k) => k !== "mrpPaise").map((k) => (k === "photoUrls" ? "photos" : k));
      const refused = sent.filter((f) => s.refuse.has(f));
      return {
        accepted: sent.filter((f) => !s.refuse.has(f)),
        issues: refused.map((f) => ({ code: "90220", message: `The ${f} is not allowed.`, severity: "error", field: f })),
        decidesLater: s.decidesLater,
      };
    },
    listingStatus: async (token: () => Promise<string>) => {
      s.statusCalls++;
      await token();
      const error = s.statusError;
      if (error) throw error;
      return s.status;
    },
    findPages: async () => [],
    createListing: async (_t: unknown, _a: unknown, input: { sku: string; family: unknown }, options: { preview: boolean }) => {
      s.created.push({ sku: input.sku, preview: options.preview, family: input.family });
      if (options.preview && s.previewErrors) return { accepted: [], issues: [{ code: "8541", message: "Brand needs approval.", severity: "error", field: null }], decidesLater: false };
      return { accepted: ["title"], issues: [], decidesLater: true };
    },
    variationThemes: async () => ["SIZE_NAME", "COLOR_NAME", "SIZE_NAME/COLOR_NAME"],
  };
  const providers = {
    amazon: { ...common, listingRules: AMAZON_LISTING_RULES, theirsFromRead: amazonTheirsFromRead },
    flipkart: { ...common, listingRules: FLIPKART_LISTING_RULES, theirsFromRead: flipkartTheirsFromRead },
  };
  return { providerFor: (channel: "amazon" | "flipkart") => providers[channel] };
});

describe.skipIf(!isDisposableDb)("marketplace publish (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let listings: typeof import("@server/channels/platform-listing.service").platformListingService;
  let publish: typeof import("@server/channels/listing-publish.service").listingPublishService;
  let create: typeof import("@server/channels/listing-create.service").listingCreateService;
  let orgId: string;
  let categoryId: string;
  const connections: Record<string, string> = {};
  const stamp = Date.now();

  const product = async (s: string, channel: "amazon" | "flipkart" | null, extra: { familyId?: string } = {}) => {
    const p = await prisma.product.create({
      data: { name: `Hijab ${s}`, slug: `mp-${stamp}-${s}`, description: "Ours.", price: 44_900, categoryId, thumbnail: "/brand/bhendi-bazaar.png", orgId, sku: `MP-${stamp}-${s}`, ...extra },
      select: { id: true },
    });
    if (channel) {
      await prisma.channelListing.create({
        data: { connectionId: connections[channel], orgId, channel, sku: `MP-${stamp}-${s}`, skuKey: `mp-${stamp}-${s}`, externalId: `X${s}`, productId: p.id, linkSource: "SKU", linkedAt: new Date(), lastSeenAt: new Date(), title: `Hijab ${s}`, pricePaise: 44_900 },
      });
    }
    return p.id;
  };
  const row = async (productId: string) => prisma.platformListing.findFirstOrThrow({ where: { productId } });
  const editAndPublish = async (productId: string, channel: "amazon" | "flipkart", overrides: Record<string, unknown>, fields?: string[]) => {
    const opened = await listings.screen(orgId, productId, channel);
    await listings.save(orgId, productId, channel, { seenVersion: opened.version, overrides });
    const review = await publish.review(orgId, channel, opened.id);
    const item = review.listings[0];
    return { review, result: await publish.publish(orgId, channel, [{ id: item.id, version: item.version, fields: (fields ?? item.changes.map((c) => c.field)) as never }]), id: item.id };
  };

  const cleanup = async () => {
    await prisma.platformListing.deleteMany({ where: { orgId } });
    await prisma.channelListing.deleteMany({ where: { orgId } });
    await prisma.product.deleteMany({ where: { orgId, sku: { startsWith: `MP-${stamp}` } } });
    await prisma.productFamily.deleteMany({ where: { orgId, name: { startsWith: `MP family ${stamp}` } } });
  };

  let sealedTokens: () => { refreshToken: string; accessToken: string; accessTokenExpiresAt: Date };

  beforeAll(async () => {
    const { encryptSecret } = await import("@server/shared/crypto");
    sealedTokens = () => ({ refreshToken: encryptSecret("refresh"), accessToken: encryptSecret("access"), accessTokenExpiresAt: new Date(Date.now() + 3_600_000) });
    ({ prisma } = await import("@server/shared/prisma"));
    ({ platformListingService: listings } = await import("@server/channels/platform-listing.service"));
    ({ listingPublishService: publish } = await import("@server/channels/listing-publish.service"));
    ({ listingCreateService: create } = await import("@server/channels/listing-create.service"));
    ({ orgId, categoryId } = await ensureFixtures());
    await cleanup();
    await prisma.channelLocation.deleteMany({ where: { orgId } });
    await prisma.channelConnection.deleteMany({ where: { orgId } });
    for (const channel of ["amazon", "flipkart"] as const) {
      connections[channel] = (await prisma.channelConnection.create({ data: { orgId, channel, state: "CONNECTED", externalAccountId: `${channel}-${stamp}`, ...sealedTokens() }, select: { id: true } })).id;
    }
  });
  beforeEach(async () => {
    await cleanup();
    Object.assign(fake.state, { published: [], created: [], refuse: new Set(), decidesLater: true, busy: false, previewErrors: false, statusError: null, status: { found: true, live: true, issues: [], showing: { title: null, mainImageUrl: null } } });
  });
  afterAll(async () => {
    await cleanup();
    await prisma.channelConnection.deleteMany({ where: { orgId } });
  });

  it("sends only the changes kept on the review, and records them as sent (spec A1, D3)", async () => {
    const id = await product("KEPT", "amazon");
    const { review, result } = await editAndPublish(id, "amazon", { title: "Crepe Hijab, Olive", price: 39_900 }, ["title"]);
    expect(review.listings[0].changes.map((c) => c.field).sort()).toEqual(["price", "title"]);
    expect(review.listings[0].changes.find((c) => c.field === "price")?.big).toBe(false);
    expect(result).toEqual({ sent: 1, refused: [] });
    await publish.send((await row(id)).id);
    expect(fake.state.published).toEqual([{ sku: `MP-${stamp}-KEPT`, changes: { title: "Crepe Hijab, Olive", mrpPaise: null } }]);
    expect((await listings.screen(orgId, id, "amazon")).status.status).toBe("checking");
    const listingId = (await row(id)).id;
    await publish.check(listingId);
    await publish.check(listingId);
    expect((await listings.screen(orgId, id, "amazon")).waitingFields).toEqual(["price"]);
  });

  it("keeps a field Amazon refuses at a later look waiting, so it can be published again (review 5, spec A2)", async () => {
    const id = await product("LATER", "amazon");
    await editAndPublish(id, "amazon", { title: "Free hijab", price: 39_900 });
    const listingId = (await row(id)).id;
    await publish.send(listingId);
    fake.state.status = { ...fake.state.status, issues: [{ code: "90220", message: "Title not allowed.", severity: "error", field: "title" }] };
    await publish.check(listingId);
    const screen = await listings.screen(orgId, id, "amazon");
    expect(screen.status.status).toBe("live_refused");
    expect(screen.waitingFields).toEqual(["title"]);
    expect((await publish.review(orgId, "amazon", listingId)).listings).toHaveLength(1);
  });

  it("counts a look that cannot be made, so the wait always ends; refused access asks to reconnect (review 2)", async () => {
    const id = await product("NOLOOK", "amazon");
    await editAndPublish(id, "amazon", { title: "Looked at" });
    const listingId = (await row(id)).id;
    await publish.send(listingId);
    await prisma.platformListing.update({ where: { id: listingId }, data: { nextCheckAt: new Date(Date.now() - 1000) } });
    const { MarketplaceAuthError } = await import("@server/channels/providers/marketplace-provider");
    fake.state.statusError = new MarketplaceAuthError("rejected");
    let renewed = 0;
    await publish.checkDue(async () => void renewed++);
    const after = await row(id);
    expect(after.publishState).toBe("attention");
    expect(after.checkCount).toBe(1);
    expect(renewed).toBe(0);
  });

  it("ends a send the queue gave up on instead of leaving it 'Sent' (review 1)", async () => {
    const id = await product("STUCK", "amazon");
    await editAndPublish(id, "amazon", { title: "Never sent" });
    await prisma.platformListing.update({ where: { id: (await row(id)).id }, data: { publishedAt: new Date(Date.now() - 2 * 3_600_000) } });
    await publish.daily();
    expect((await row(id)).publishState).toBe("attention");
  });

  it("sends a WebP photo to Amazon as a JPEG of it, and a product save leaves nothing waiting (photos by address)", async () => {
    const id = await product("PHOTO", "amazon");
    const asset = await prisma.mediaAsset.create({ data: { kind: "IMAGE", ref: `https://cdn.test/${stamp}.webp`, mimeType: "image/webp", source: "UPLOAD", orgId }, select: { id: true } });
    await prisma.productMedia.create({ data: { productId: id, kind: "IMAGE", ref: `https://cdn.test/${stamp}.webp`, assetId: asset.id, position: 0, isThumbnail: true } });
    const opened = await listings.screen(orgId, id, "amazon");
    expect(opened.waitingFields).toEqual([]);
    // A product save renews its media rows: same address, new id.
    await prisma.productMedia.deleteMany({ where: { productId: id } });
    await prisma.productMedia.create({ data: { productId: id, kind: "IMAGE", ref: `https://cdn.test/${stamp}.webp`, assetId: asset.id, position: 0, isThumbnail: true } });
    expect((await listings.screen(orgId, id, "amazon")).waitingFields).toEqual([]);
    const { result } = await editAndPublish(id, "amazon", { photos: [`https://cdn.test/${stamp}.webp`], title: "With photo" });
    expect(result.sent).toBe(1);
    await publish.send((await row(id)).id);
    expect(fake.state.published.at(-1)?.changes.photoUrls ?? null).toBeNull();
    await prisma.productMedia.deleteMany({ where: { productId: id } });
    await prisma.mediaAsset.delete({ where: { id: asset.id } });
  });

  it("puts a changed photo order to Amazon as JPEG addresses (marketplace-publish D2)", async () => {
    const id = await product("ORDER", "amazon");
    const assets = await Promise.all(["a", "b"].map((k, i) =>
      prisma.mediaAsset.create({ data: { kind: "IMAGE", ref: `https://cdn.test/${stamp}-${k}.webp`, mimeType: "image/webp", source: "UPLOAD", orgId }, select: { id: true, ref: true } })
        .then(async (a) => {
          await prisma.productMedia.create({ data: { productId: id, kind: "IMAGE", ref: a.ref, assetId: a.id, position: i, isThumbnail: i === 0 } });
          return a;
        })));
    await editAndPublish(id, "amazon", { photos: [assets[1].ref, assets[0].ref] });
    await publish.send((await row(id)).id);
    expect(fake.state.published.at(-1)?.changes.photoUrls).toEqual([`https://cdn.test/${assets[1].id}.marketplaceJpeg.jpg`, `https://cdn.test/${assets[0].id}.marketplaceJpeg.jpg`]);
    await prisma.productMedia.deleteMany({ where: { productId: id } });
    await prisma.mediaAsset.deleteMany({ where: { id: { in: assets.map((a) => a.id) } } });
  });

  it("refuses a publish of a listing changed since the review (D3)", async () => {
    const id = await product("STALE", "amazon");
    const opened = await listings.screen(orgId, id, "amazon");
    await listings.save(orgId, id, "amazon", { seenVersion: opened.version, overrides: { title: "First" } });
    const review = await publish.review(orgId, "amazon", opened.id);
    const again = await listings.screen(orgId, id, "amazon");
    await listings.save(orgId, id, "amazon", { seenVersion: again.version, overrides: { title: "Second" } });
    const result = await publish.publish(orgId, "amazon", [{ id: opened.id, version: review.listings[0].version, fields: ["title"] }]);
    expect(result).toEqual({ sent: 0, refused: [opened.id] });
  });

  it("keeps a refused field waiting with the marketplace's words on it (spec A2, Q6)", async () => {
    const id = await product("REFUSED", "amazon");
    fake.state.refuse = new Set(["title"]);
    await editAndPublish(id, "amazon", { title: "Free size hijab", price: 39_900 });
    await publish.send((await row(id)).id);
    const screen = await listings.screen(orgId, id, "amazon");
    expect(screen.status.status).toBe("live_refused");
    expect(screen.waitingFields).toEqual(["title"]);
    expect(screen.issues).toEqual([{ code: "90220", message: "The title is not allowed.", severity: "error", field: "title" }]);
  });

  it("marks a price more than 30% away from what is live as a big change (spec A8, Q13)", async () => {
    const id = await product("BIG", "amazon");
    const opened = await listings.screen(orgId, id, "amazon");
    await listings.save(orgId, id, "amazon", { seenVersion: opened.version, overrides: { price: 9_900 } });
    const review = await publish.review(orgId, "amazon", opened.id);
    expect(review.listings[0].changes).toEqual([{ field: "price", from: 44_900, to: 9_900, big: true }]);
  });

  it("follows Amazon's answer and stops once it has one (D5)", async () => {
    const id = await product("CHECK", "amazon");
    await editAndPublish(id, "amazon", { title: "Checked" });
    const listingId = (await row(id)).id;
    await publish.send(listingId);
    await publish.check(listingId);
    expect((await row(id)).publishState).toBe("checking");
    await publish.check(listingId);
    const done = await row(id);
    expect(done.publishState).toBe("idle");
    expect(done.nextCheckAt).toBeNull();
    expect((await listings.screen(orgId, id, "amazon")).status.status).toBe("live");
  });

  it("leaves a listing 'Sent' and throws when the marketplace is busy, so the queue retries (Q15)", async () => {
    const id = await product("BUSY", "amazon");
    await editAndPublish(id, "amazon", { title: "Later" });
    fake.state.busy = true;
    await expect(publish.send((await row(id)).id)).rejects.toThrow(/unavailable/i);
    expect((await row(id)).publishState).toBe("sent");
  });

  it("takes Flipkart's answer as final: price live at once (spec A6)", async () => {
    const id = await product("FK", "flipkart");
    fake.state.decidesLater = false;
    await editAndPublish(id, "flipkart", { price: 42_900 });
    await publish.send((await row(id)).id);
    const screen = await listings.screen(orgId, id, "flipkart");
    expect(screen.status.status).toBe("live");
    expect(screen.waitingFields).toEqual([]);
  });

  it("records Flipkart's price as the whole rupees it holds, and nothing waits after (review 4, Q13)", async () => {
    const id = await product("FKR", "flipkart");
    fake.state.decidesLater = false;
    await editAndPublish(id, "flipkart", { price: 42_950 });
    await publish.send((await row(id)).id);
    expect(fake.state.published[0].changes.price).toBe(42_900);
    expect((await listings.screen(orgId, id, "flipkart")).waitingFields).toEqual([]);
  });

  it("creates nothing when Amazon's check-only answer has an error (Q9)", async () => {
    const id = await product("NEW", null);
    fake.state.previewErrors = true;
    const { id: listingId } = await create.startDraft(orgId, id, "amazon", { mode: "new", targetExternalId: null });
    const review = await publish.review(orgId, "amazon", listingId);
    expect(review.listings[0].creating).toBe(true);
    await publish.publish(orgId, "amazon", [{ id: listingId, version: review.listings[0].version, fields: review.listings[0].changes.map((c) => c.field) }]);
    await publish.send(listingId);
    expect(fake.state.created.map((c) => c.preview)).toEqual([true]);
    const screen = await listings.screen(orgId, id, "amazon");
    expect(screen.status.status).toBe("attention");
    expect(screen.issues[0].message).toBe("Brand needs approval.");
  });

  it("creates after a clean check, and links the new listing once Amazon has it (spec A4, D6)", async () => {
    const id = await product("MADE", null);
    const { id: listingId } = await create.startDraft(orgId, id, "amazon", { mode: "offer", targetExternalId: "B0TEST1234" });
    const review = await publish.review(orgId, "amazon", listingId);
    await publish.publish(orgId, "amazon", [{ id: listingId, version: review.listings[0].version, fields: review.listings[0].changes.map((c) => c.field) }]);
    await publish.send(listingId);
    expect(fake.state.created.map((c) => c.preview)).toEqual([false]);
    await publish.check(listingId);
    await publish.check(listingId);
    const mirror = await prisma.channelListing.findFirstOrThrow({ where: { productId: id, connectionId: connections.amazon } });
    expect(mirror.externalId).toBe("B0TEST1234");
    expect((await row(id)).channelListingId).toBe(mirror.id);
  });

  it("makes a family's page before its members, which wait for it (spec A5, D7)", async () => {
    const family = await prisma.productFamily.create({ data: { orgId, name: `MP family ${stamp}`, variantAxis: ["colour"] }, select: { id: true } });
    const a = await product("FAM-A", null, { familyId: family.id });
    await product("FAM-B", null, { familyId: family.id });
    const { id: parentId } = await create.startFamily(orgId, family.id, "amazon");
    // The fixture's category maps to no Amazon type; a real family takes its members' (Q10).
    await prisma.platformListing.updateMany({ where: { orgId }, data: { marketplaceType: "SCARF" } });
    const review = await publish.review(orgId, "amazon");
    expect(review.listings).toHaveLength(3);
    await publish.publish(orgId, "amazon", review.listings.map((l) => ({ id: l.id, version: l.version, fields: l.changes.map((c) => c.field) })));
    const member = await row(a);
    await expect(publish.send(member.id)).rejects.toThrow(/unavailable/i);
    await publish.send(parentId);
    await publish.send(member.id);
    expect(fake.state.created.filter((c) => !c.preview).map((c) => (c.family as { role: string } | null)?.role)).toEqual(["parent", "child"]);
    expect((fake.state.created.at(-1)?.family as { theme: string }).theme).toBe("COLOR_NAME");
  });

  it("refuses a member published without its family's page rather than retrying for ever (review 1, D7)", async () => {
    const family = await prisma.productFamily.create({ data: { orgId, name: `MP family ${stamp} alone`, variantAxis: ["colour"] }, select: { id: true } });
    const a = await product("ALONE-A", null, { familyId: family.id });
    await create.startFamily(orgId, family.id, "amazon");
    await prisma.platformListing.updateMany({ where: { orgId }, data: { marketplaceType: "SCARF" } });
    const member = await row(a);
    const review = await publish.review(orgId, "amazon", member.id);
    await publish.publish(orgId, "amazon", [{ id: member.id, version: review.listings[0].version, fields: review.listings[0].changes.map((c) => c.field) }]);
    await publish.send(member.id);
    const after = await row(a);
    expect(after.publishState).toBe("attention");
    expect((after.issues as Array<{ code: string }>)[0].code).toBe("no_parent");
  });

  describe("the answer check's schedule and cost (Q22)", () => {
    /** A listing sent, waiting on its marketplace's answer, its next look due now. */
    const waitingAndDue = async (s: string) => {
      const id = await product(s, "amazon");
      await editAndPublish(id, "amazon", { title: `Waiting ${s}` });
      const listingId = (await row(id)).id;
      await publish.send(listingId);
      await prisma.platformListing.update({ where: { id: listingId }, data: { nextCheckAt: new Date(Date.now() - 1000) } });
      return listingId;
    };
    const quiet = () => prisma.platformListing.updateMany({ where: { orgId, publishState: { in: ["sent", "checking"] } }, data: { publishState: "idle", nextCheckAt: null } });

    beforeEach(async () => {
      fake.state.statusError = null;
      fake.state.status = { found: false, live: true, issues: [], showing: { title: null, mainImageUrl: null } };
      await quiet();
    });

    it("runs again when the next look falls due, not on a fixed two minutes", async () => {
      const listingId = await waitingAndDue("SCHED");
      const asked: number[] = [];
      await publish.checkDue(async (after) => void asked.push(after));
      const after = await prisma.platformListing.findUniqueOrThrow({ where: { id: listingId } });
      expect(after.checkCount).toBe(1);
      const untilNext = Math.ceil((after.nextCheckAt!.getTime() - Date.now()) / 1000);
      expect(asked).toHaveLength(1);
      expect(asked[0]).toBeGreaterThan(300); // the second look is ten minutes after the send
      expect(Math.abs(asked[0] - untilNext)).toBeLessThanOrEqual(2);
    });

    it("a send's first look is not swallowed by a run already queued far ahead", async () => {
      const { enqueueListingCheck } = await import("@server/channels/listing-publish.job");
      // Moments no other test aims at, so only these two calls can share a slot.
      const far = 7_200 * 24 + Math.floor(Math.random() * 1_000) * 120;
      const near = 3_600 * 12 + Math.floor(Math.random() * 100) * 120;
      expect(await enqueueListingCheck(prisma, far)).toBe(true);
      expect(await enqueueListingCheck(prisma, near)).toBe(true); // the far run does not swallow it
      expect(await enqueueListingCheck(prisma, far)).toBe(false); // aimed at the same moment: one run
    });

    it("does not ask a marketplace through a connection the shop must reconnect", async () => {
      const listingId = await waitingAndDue("RECONNECT");
      await prisma.channelConnection.update({ where: { id: connections.amazon }, data: { state: "NEEDS_RECONNECT" } });
      try {
        fake.state.statusCalls = 0;
        await publish.checkDue(async () => {});
        expect(fake.state.statusCalls).toBe(0);
        expect((await prisma.platformListing.findUniqueOrThrow({ where: { id: listingId } })).checkCount).toBe(1);
      } finally {
        await prisma.channelConnection.update({ where: { id: connections.amazon }, data: { state: "CONNECTED" } });
      }
    });

    it("one shop's unreadable stored token fails that shop's looks, not the run", async () => {
      const amazonListing = await waitingAndDue("BADTOKEN");
      const flipkartProduct = await product("GOODTOKEN", "flipkart");
      await editAndPublish(flipkartProduct, "flipkart", { price: 39_900 });
      const flipkartListing = (await row(flipkartProduct)).id;
      await prisma.platformListing.update({ where: { id: flipkartListing }, data: { publishState: "checking", nextCheckAt: new Date(Date.now() - 1000), checkCount: 0, publishedAt: new Date() } });
      await prisma.channelConnection.update({ where: { id: connections.amazon }, data: { accessToken: "not-a-sealed-secret" } });
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        await publish.checkDue(async () => {});
      } finally {
        errors.mockRestore();
        await prisma.channelConnection.update({ where: { id: connections.amazon }, data: sealedTokens() });
      }
      const bad = await prisma.platformListing.findUniqueOrThrow({ where: { id: amazonListing } });
      const good = await prisma.platformListing.findUniqueOrThrow({ where: { id: flipkartListing } });
      expect(bad.checkCount).toBe(1); // a missed look, counted
      expect(good.checkCount).toBe(1);
      expect(good.checkedAt).not.toBeNull();
    });

    it("asks for no further run once nothing waits", async () => {
      const asked: number[] = [];
      await publish.checkDue(async (after) => void asked.push(after));
      expect(asked).toEqual([]);
    });

    it("costs one write more per listing looked at, not a read per listing", async () => {
      await waitingAndDue("COST1");
      counting = true;
      statements = 0;
      await publish.checkDue(async () => {});
      const one = statements;
      counting = false;

      await quiet();
      for (const s of ["COST2", "COST3", "COST4", "COST5"]) await waitingAndDue(s);
      counting = true;
      statements = 0;
      await publish.checkDue(async () => {});
      const four = statements;
      counting = false;

      expect(four - one, `one listing cost ${one}, four cost ${four}`).toBe(3);
    });
  });
});
