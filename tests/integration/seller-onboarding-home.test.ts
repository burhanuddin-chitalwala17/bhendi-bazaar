/**
 * Home's setup list and its "new reviews" line against a real schema (seller-onboarding U3;
 * R3, A6; D5, D6, D7; Q3, Q23, Q24). Hide, unhide and the first share are conditional writes, so
 * a double tap writes once and never moves the contact version; the pickup step needs a street
 * and a contact; a withdrawn or week-old review is not "new". Owns its world: a fresh org.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";
import { ONBOARDING_STEP } from "@server/catalog/org-onboarding.types";

describe.skipIf(!isDisposableDb)("seller onboarding Home (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let orgRepository: typeof import("@server/catalog/org.repository").orgRepository;
  let onboarding: typeof import("@server/catalog/org-onboarding.service").orgOnboardingService;
  let reviewService: typeof import("@server/catalog/review.service").reviewService;
  let orgAddressService: typeof import("@server/catalog/org.address.service").orgAddressService;
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  let orgId: string;
  const productIds: string[] = [];
  let fixtures: Awaited<ReturnType<typeof ensureFixtures>>;

  const location = {
    name: "Shop",
    contactPhone: "9000000051",
    addressLine1: "1 Setup Lane",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400001",
  };

  const product = async (name: string) => {
    const row = await prisma.product.create({
      data: {
        name,
        slug: `${name.toLowerCase().replace(/\s+/g, "-")}-${stamp}`,
        description: "fixture",
        price: 10_000,
        thumbnail: "https://example.invalid/home.webp",
        categoryId: fixtures.categoryId,
        orgId,
      },
      select: { id: true },
    });
    productIds.push(row.id);
    return row.id;
  };

  const review = (productId: string, createdAt: Date, state: Record<string, Date> = {}) =>
    prisma.review.create({
      data: { productId, userId: fixtures.userId, userName: "Home Buyer", rating: 5, comment: "ok", createdAt, ...state },
    });

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ orgRepository } = await import("@server/catalog/org.repository"));
    ({ orgOnboardingService: onboarding } = await import("@server/catalog/org-onboarding.service"));
    ({ reviewService } = await import("@server/catalog/review.service"));
    ({ orgAddressService } = await import("@server/catalog/org.address.service"));
    fixtures = await ensureFixtures();
    const org = await orgRepository.create({
      code: `HOME-T${stamp}`.slice(0, 20),
      handle: `home-test-${stamp}`,
      name: `Home Test ${stamp}`,
      email: `home-${stamp}@example.invalid`,
      isActive: true,
    });
    orgId = org.id;
  });

  afterAll(async () => {
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    const links = await prisma.orgAddress.findMany({ where: { orgId }, select: { addressId: true } });
    await prisma.orgAddress.deleteMany({ where: { orgId } });
    await prisma.address.deleteMany({ where: { id: { in: links.map((link) => link.addressId) } } });
    await prisma.org.delete({ where: { id: orgId } });
  });

  const version = async () => (await prisma.org.findUniqueOrThrow({ where: { id: orgId }, select: { updatedAt: true } })).updatedAt;

  it("a new shop is 1 of 5 done and its list is showing (A1)", async () => {
    const status = await onboarding.status(orgId);
    expect(status.doneCount).toBe(1);
    expect(status.hidden).toBe(false);
  });

  it("hide is written once under a double tap, and leaves the contact version alone (Q23, D6)", async () => {
    const before = await version();
    const writes = await Promise.all([orgRepository.hideSetup(orgId, new Date()), orgRepository.hideSetup(orgId, new Date())]);
    expect(writes.reduce((a, b) => a + b, 0)).toBe(1);
    const first = (await orgRepository.findSetupMarks(orgId))?.setupHiddenAt;
    await onboarding.hide(orgId, new Date(Date.now() + 60_000));
    expect((await orgRepository.findSetupMarks(orgId))?.setupHiddenAt).toEqual(first);
    expect(await version()).toEqual(before);
    expect((await onboarding.status(orgId)).hidden).toBe(true);
  });

  it("unhide is written once and brings the list back (A6)", async () => {
    const writes = await Promise.all([orgRepository.showSetup(orgId), orgRepository.showSetup(orgId)]);
    expect(writes.reduce((a, b) => a + b, 0)).toBe(1);
    expect((await onboarding.status(orgId)).hidden).toBe(false);
  });

  it("keeps only the first share, and ticks the share step (Q3)", async () => {
    const first = new Date("2026-11-01T10:00:00Z");
    await Promise.all([onboarding.markShared(orgId, first), onboarding.markShared(orgId, first)]);
    await onboarding.markShared(orgId, new Date("2026-11-02T10:00:00Z"));
    expect((await orgRepository.findSetupMarks(orgId))?.firstSharedAt).toEqual(first);
    const status = await onboarding.status(orgId);
    expect(status.steps.find((step) => step.key === ONBOARDING_STEP.SHARE)?.done).toBe(true);
  });

  it("a pickup address ticks only with a street and a contact (Q3)", async () => {
    const pickupDone = async () => (await onboarding.status(orgId)).steps.find((s) => s.key === ONBOARDING_STEP.ADDRESS)?.done;
    await orgAddressService.addLocation(orgId, { ...location, contactName: "" });
    expect(await pickupDone()).toBe(false);
    await orgAddressService.addLocation(orgId, { ...location, name: "Godown", contactName: "Hussain" });
    expect(await pickupDone()).toBe(true);
  });

  it("counts a review from this week as new, and not a withdrawn or older one (Q24, Q13)", async () => {
    const now = new Date();
    const days = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
    const saree = await product("Home saree");
    await review(saree, days(1));
    await review(saree, days(2), { withdrawnAt: now });
    await review(saree, days(9));
    expect(await reviewService.newForOrg(orgId, now)).toEqual({ count: 1, productId: saree });

    const shawl = await product("Home shawl");
    await review(shawl, days(3));
    expect(await reviewService.newForOrg(orgId, now)).toEqual({ count: 2, productId: null });
  });
});
