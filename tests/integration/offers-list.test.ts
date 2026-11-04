/**
 * The offers list (offers list Q1) against a real schema: a shop sees only its own offers whatever
 * the URL says, each status tab holds what its badge says, and search finds a covered product's
 * SKU. Owns its fixtures: a second shop and offers prefixed for this suite.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";
import { OFFER_KIND, OFFER_STATUS, type OfferListQuery } from "@server/promotions/promotion.types";

const PREFIX = "offers-list-";
const HOUR = 3_600_000;

describe.skipIf(!isDisposableDb)("offers list: scope, status tabs and search", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let service: typeof import("@server/promotions/admin.promotion.service").adminPromotionService;
  let fixtures: Awaited<ReturnType<typeof ensureFixtures>>;
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date();
  let otherOrgId: string;
  let productId: string;
  const sku = `OL-${stamp}`.toUpperCase();

  const query = (over: Partial<OfferListQuery> = {}): OfferListQuery => ({
    status: OFFER_STATUS.ALL, kind: OFFER_KIND.ALL, search: PREFIX + stamp, sortBy: "createdAt", sortOrder: "desc", page: 1, ...over,
  });

  const offer = (orgId: string, name: string, o: { startsAt: Date; endsAt: Date; isActive?: boolean; productId?: string }) =>
    prisma.promotion.create({
      data: {
        label: `${PREFIX}${stamp} ${name}`, scope: "ORG", orgId, trigger: "AUTOMATIC", valueType: "PERCENT", percentBps: 1000,
        startsAt: o.startsAt, endsAt: o.endsAt, isActive: o.isActive ?? true,
        ...(o.productId ? { targets: { create: [{ productId: o.productId }] } } : {}),
      },
    });

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ adminPromotionService: service } = await import("@server/promotions/admin.promotion.service"));
    fixtures = await ensureFixtures();
    otherOrgId = (await prisma.org.create({
      data: { code: `OL-${stamp}`.slice(0, 30), handle: `ol-${stamp}`, name: "Other shop", email: `ol-${stamp}@example.invalid` },
      select: { id: true },
    })).id;
    productId = (await prisma.product.create({
      data: {
        name: `${PREFIX}${stamp} tote`, slug: `${PREFIX}${stamp}`, description: "fixture", price: 10_000, sku,
        thumbnail: "https://example.invalid/x.webp", categoryId: fixtures.categoryId, orgId: fixtures.orgId,
      },
      select: { id: true },
    })).id;
    await offer(fixtures.orgId, "live", { startsAt: new Date(now.getTime() - HOUR), endsAt: new Date(now.getTime() + HOUR), productId });
    await offer(fixtures.orgId, "scheduled", { startsAt: new Date(now.getTime() + HOUR), endsAt: new Date(now.getTime() + 2 * HOUR) });
    await offer(fixtures.orgId, "ended", { startsAt: new Date(now.getTime() - 2 * HOUR), endsAt: new Date(now.getTime() - HOUR) });
    await offer(fixtures.orgId, "stopped", { startsAt: new Date(now.getTime() - HOUR), endsAt: new Date(now.getTime() + HOUR), isActive: false });
    // Stopped and past its end: Stopped, never Ended (stopped wins over dates).
    await offer(fixtures.orgId, "stopped and past", { startsAt: new Date(now.getTime() - 3 * HOUR), endsAt: new Date(now.getTime() - 2 * HOUR), isActive: false });
    // Another shop's offer with the same words: never on this shop's list.
    await offer(otherOrgId, "live elsewhere", { startsAt: new Date(now.getTime() - HOUR), endsAt: new Date(now.getTime() + HOUR) });
  });

  afterAll(async () => {
    const ours = { label: { startsWith: PREFIX } };
    await prisma.promotionTarget.deleteMany({ where: { promotion: ours } });
    await prisma.promotion.deleteMany({ where: ours });
    await prisma.product.deleteMany({ where: { id: productId } });
    await prisma.org.deleteMany({ where: { id: otherOrgId } });
  });

  const own = { scope: "ORG" as const, orgId: "" };
  const labels = (r: { offers: { label: string }[] }) => r.offers.map((o) => o.label.replace(`${PREFIX}${stamp} `, "")).sort();

  it("lists only this shop's offers, even when another shop's match the search", async () => {
    const r = await service.listOffers({ ...own, orgId: fixtures.orgId }, query(), now);
    expect(labels(r)).toEqual(["ended", "live", "scheduled", "stopped", "stopped and past"]);
  });

  it("puts each offer under the tab its status names", async () => {
    const tab = async (status: OfferListQuery["status"]) => labels(await service.listOffers({ ...own, orgId: fixtures.orgId }, query({ status }), now));
    expect(await tab(OFFER_STATUS.LIVE)).toEqual(["live"]);
    expect(await tab(OFFER_STATUS.SCHEDULED)).toEqual(["scheduled"]);
    expect(await tab(OFFER_STATUS.ENDED)).toEqual(["ended"]);
    expect(await tab(OFFER_STATUS.STOPPED)).toEqual(["stopped", "stopped and past"]);
  });

  it("finds an offer by the SKU of a product it covers", async () => {
    const r = await service.listOffers({ ...own, orgId: fixtures.orgId }, query({ search: sku.toLowerCase() }), now);
    expect(labels(r)).toEqual(["live"]);
  });

  it("counts the tabs within the shop", async () => {
    const r = await service.listOffers({ ...own, orgId: otherOrgId }, query(), now);
    expect(r.counts[OFFER_STATUS.ALL]).toBe(1);
    expect(r.counts[OFFER_STATUS.LIVE]).toBe(1);
  });
});
