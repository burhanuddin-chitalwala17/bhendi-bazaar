/**
 * checkout-links: a link is made holding products and quantities, opened once per cart at today's
 * prices with anything out of stock left out, and an edited or expired one adds nothing (unit 1);
 * checkout's notes, the size step and the all-gone open (unit 2).
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureFixtures, FIXTURE_KEYS, isDisposableDb, type Fixtures } from "../helpers/test-db";

const PREFIX = "checkout-link-";

describe.skipIf(!isDisposableDb)("checkout links", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let DomainError: typeof import("@server/shared/domain-error").DomainError;
  let service: typeof import("@server/cart/checkout-link.service").checkoutLinkService;
  let fx: Fixtures;
  const unique = () => `${PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  beforeAll(async () => {
    process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
    ({ prisma } = await import("@server/shared/prisma"));
    ({ checkoutLinkService: service } = await import("@server/cart/checkout-link.service"));
    ({ DomainError } = await import("@server/shared/domain-error"));
    fx = await ensureFixtures();
  });

  afterAll(async () => {
    const products = await prisma.product.findMany({ where: { name: { startsWith: PREFIX } }, select: { id: true } });
    await prisma.checkoutLink.deleteMany({ where: { sourceRef: { startsWith: PREFIX } } });
    await prisma.product.deleteMany({ where: { id: { in: products.map((p) => p.id) } } });
    await prisma.productFamily.deleteMany({ where: { name: { startsWith: PREFIX } } });
  });

  async function product(price: number, stock: number, orgId = fx.orgId, name = unique(), familyId?: string) {
    const location =
      orgId === fx.orgId
        ? fx.orgAddressId
        : (await prisma.orgAddress.findFirst({ where: { orgId, isActive: true }, select: { id: true } }))?.id;
    return prisma.product.create({
      data: {
        name, slug: name, description: "fixture", price, thumbnail: "https://example.invalid/x.webp",
        weight: 0.5, categoryId: fx.categoryId, orgId, familyId,
        ...(location ? { stockLocations: { create: { orgAddressId: location, quantity: stock } } } : {}),
      },
      select: { id: true, slug: true, name: true },
    });
  }

  const make = (items: Array<{ productId: string; quantity: number; pickSize?: boolean }>) =>
    service.create({ orgId: fx.orgId, items, source: "INBOX_ORDER", sourceRef: unique() });

  it("a link opens with its items at today's prices, never the price it was made at (spec A1)", async () => {
    const kurta = await product(129_900, 5);
    const dupatta = await product(49_900, 5);
    const link = await make([{ productId: kurta.id, quantity: 1 }, { productId: dupatta.id, quantity: 2 }]);
    expect(link.url).toMatch(new RegExp(`/c/${FIXTURE_KEYS.orgHandle}/${link.token}$`));
    expect(link.token).toMatch(/^[A-Za-z0-9_-]{22}$/);

    const stored = await prisma.checkoutLink.findUniqueOrThrow({ where: { id: link.id } });
    expect(stored.displayPricesPaise).toEqual({ [kurta.id]: 129_900, [dupatta.id]: 49_900 });

    // The price moves after the link is sent; the snapshot is for "was ₹y" only.
    await prisma.product.update({ where: { id: kurta.id }, data: { price: 119_900 } });

    const opened = await service.open(FIXTURE_KEYS.orgHandle, link.token, `device:${unique()}`);
    expect(opened.kind).toBe("opened");
    if (opened.kind !== "opened") return;
    expect(opened.alreadyOpened).toBe(false);
    expect(opened.leftOut).toEqual([]);
    expect(opened.lines.map((l) => [l.productId, l.quantity, l.price, l.fromLinkId])).toEqual([
      [kurta.id, 1, 119_900, link.id],
      [dupatta.id, 2, 49_900, link.id],
    ]);
  });

  it("an item out of stock when opened is left out and named (spec A2)", async () => {
    const kurta = await product(129_900, 5);
    const dupatta = await product(49_900, 1);
    const link = await make([{ productId: kurta.id, quantity: 1 }, { productId: dupatta.id, quantity: 1 }]);
    await prisma.productStock.updateMany({ where: { productId: dupatta.id }, data: { quantity: 0 } });

    const opened = await service.open(FIXTURE_KEYS.orgHandle, link.token, `device:${unique()}`);
    if (opened.kind !== "opened") throw new Error(opened.kind);
    expect(opened.lines.map((l) => l.productId)).toEqual([kurta.id]);
    expect(opened.leftOut).toEqual([{ productId: dupatta.id, productName: dupatta.name }]);
  });

  it("an archived product is left out by name too (spec A2)", async () => {
    const kurta = await product(129_900, 5);
    const link = await make([{ productId: kurta.id, quantity: 1 }]);
    await prisma.product.update({ where: { id: kurta.id }, data: { archivedAt: new Date() } });

    const opened = await service.open(FIXTURE_KEYS.orgHandle, link.token, `device:${unique()}`);
    if (opened.kind !== "opened") throw new Error(opened.kind);
    expect(opened.lines).toEqual([]);
    expect(opened.leftOut.map((l) => l.productId)).toEqual([kurta.id]);
  });

  it("opening the same link again for the same cart adds nothing; another cart still gets it (spec A3)", async () => {
    const kurta = await product(129_900, 5);
    const link = await make([{ productId: kurta.id, quantity: 1 }]);
    const cart = `user:${fx.userId}:${unique()}`;

    const first = await service.open(FIXTURE_KEYS.orgHandle, link.token, cart);
    const second = await service.open(FIXTURE_KEYS.orgHandle, link.token, cart);
    if (first.kind !== "opened" || second.kind !== "opened") throw new Error("not opened");
    expect(first.lines).toHaveLength(1);
    expect(second).toMatchObject({ alreadyOpened: true, lines: [], leftOut: [] });

    const other = await service.open(FIXTURE_KEYS.orgHandle, link.token, `device:${unique()}`);
    if (other.kind !== "opened") throw new Error(other.kind);
    expect(other.lines).toHaveLength(1);
    expect(await prisma.checkoutLinkOpen.count({ where: { linkId: link.id } })).toBe(2);
  });

  it("two opens at once for one cart: exactly one gets the lines (spec A3)", async () => {
    const kurta = await product(129_900, 5);
    const link = await make([{ productId: kurta.id, quantity: 1 }]);
    const cart = `device:${unique()}`;
    const results = await Promise.all([1, 2, 3].map(() => service.open(FIXTURE_KEYS.orgHandle, link.token, cart)));
    const added = results.filter((r) => r.kind === "opened" && !r.alreadyOpened);
    expect(added).toHaveLength(1);
  });

  it("an edited token, or the right token under another shop, is unknown and claims nothing (spec A4)", async () => {
    const kurta = await product(129_900, 5);
    const link = await make([{ productId: kurta.id, quantity: 1 }]);
    const edited = (link.token[0] === "A" ? "B" : "A") + link.token.slice(1);

    expect(await service.open(FIXTURE_KEYS.orgHandle, edited, `device:${unique()}`)).toEqual({ kind: "unknown" });
    expect(await service.open(FIXTURE_KEYS.otherOrgHandle, link.token, `device:${unique()}`)).toEqual({ kind: "unknown" });
    expect(await service.open(FIXTURE_KEYS.orgHandle, "not-a-token", `device:${unique()}`)).toEqual({ kind: "unknown" });
    expect(await service.resolve(FIXTURE_KEYS.orgHandle, edited)).toEqual({ kind: "unknown" });
    expect(await prisma.checkoutLinkOpen.count({ where: { linkId: link.id } })).toBe(0);
  });

  it("an expired link points at its first product and adds nothing (spec A4)", async () => {
    const kurta = await product(129_900, 5);
    const link = await make([{ productId: kurta.id, quantity: 1 }]);
    const later = new Date(link.expiresAt.getTime() + 1);

    expect(await service.resolve(FIXTURE_KEYS.orgHandle, link.token, later)).toEqual({ kind: "expired", productSlug: kurta.slug });
    expect(await service.open(FIXTURE_KEYS.orgHandle, link.token, `device:${unique()}`, later)).toEqual({
      kind: "expired",
      productSlug: kurta.slug,
    });
    expect(await prisma.checkoutLinkOpen.count({ where: { linkId: link.id } })).toBe(0);
    // Seven days (Q1).
    expect(link.expiresAt.getTime() - (await prisma.checkoutLink.findUniqueOrThrow({ where: { id: link.id } })).createdAt.getTime())
      .toBeGreaterThanOrEqual(7 * 24 * 60 * 60 * 1000 - 5_000);
  });

  it("a link names only this shop's products on sale, never a price", async () => {
    const theirs = await product(10_000, 5, fx.otherOrgId);
    await expect(make([{ productId: theirs.id, quantity: 1 }])).rejects.toBeInstanceOf(DomainError);
    const archived = await product(10_000, 5);
    await prisma.product.update({ where: { id: archived.id }, data: { archivedAt: new Date() } });
    await expect(make([{ productId: archived.id, quantity: 1 }])).rejects.toBeInstanceOf(DomainError);
    await expect(make([])).rejects.toBeInstanceOf(DomainError);
    await expect(make([{ productId: archived.id, quantity: 0 }])).rejects.toBeInstanceOf(DomainError);
  });

  it("a cart write keeps a line's link mark, and drops one naming no link", async () => {
    const { cartRepository } = await import("@server/cart/cart.repository");
    const { cartService } = await import("@server/cart/cart.service");
    const kurta = await product(129_900, 5);
    const scarf = await product(9_900, 5);
    const link = await make([{ productId: kurta.id, quantity: 1 }]);
    await cartService.updateCart(fx.userId, [
      { productId: kurta.id, quantity: 1, fromLinkId: link.id },
      { productId: scarf.id, quantity: 1, fromLinkId: "no-such-link" },
    ]);
    const saved = (await cartRepository.findByUserId(fx.userId))!;
    expect(saved.items.map((i) => [i.productId, i.fromLinkId])).toEqual(
      expect.arrayContaining([[kurta.id, link.id], [scarf.id, undefined]]),
    );
    await cartRepository.clear(fx.userId);
  });

  describe("unit 2: checkout's notes, the size step, an all-gone link", () => {
    it("checkout names an item left out and shows a price that moved, from the link's own items (spec A2, D4)", async () => {
      const kurta = await product(129_900, 5);
      const dupatta = await product(49_900, 1);
      const link = await make([{ productId: kurta.id, quantity: 1 }, { productId: dupatta.id, quantity: 1 }]);
      await prisma.productStock.updateMany({ where: { productId: dupatta.id }, data: { quantity: 0 } });
      await prisma.product.update({ where: { id: kurta.id }, data: { price: 119_900 } });

      const [note] = await service.notes([{ linkId: link.id, productIds: [kurta.id] }]);
      expect(note).toMatchObject({ linkId: link.id, shopHandle: FIXTURE_KEYS.orgHandle });
      expect(note.leftOut).toEqual([{ productId: dupatta.id, productName: dupatta.name }]);
      expect(note.priceChanges).toEqual([{ productId: kurta.id, nowPaise: 119_900, wasPaise: 129_900 }]);
    });

    it("a link line the buyer removed is not called out of stock; a product not in the link is not priced (D4, Q7)", async () => {
      const kurta = await product(129_900, 5);
      const dupatta = await product(49_900, 5);
      const stranger = await product(10_000, 5);
      const link = await make([{ productId: kurta.id, quantity: 1 }, { productId: dupatta.id, quantity: 1 }]);
      await prisma.product.update({ where: { id: stranger.id }, data: { price: 20_000 } });

      const [note] = await service.notes([{ linkId: link.id, productIds: [kurta.id, stranger.id] }]);
      expect(note.leftOut).toEqual([]);
      expect(note.priceChanges).toEqual([]);
      expect(await service.notes([{ linkId: "no-such-link", productIds: [kurta.id] }])).toEqual([]);
    });

    it("a link with everything out of stock adds nothing and claims nothing, so it works once restocked (ux.md: All out of stock)", async () => {
      const target = await product(49_900, 1);
      const made = await make([{ productId: target.id, quantity: 1 }]);
      await prisma.productStock.updateMany({ where: { productId: target.id }, data: { quantity: 0 } });

      const cart = `device:${unique()}`;
      const gone = await service.open(FIXTURE_KEYS.orgHandle, made.token, cart);
      expect(gone).toMatchObject({ kind: "opened", alreadyOpened: false, lines: [], leftOut: [{ productId: target.id }] });
      expect(await prisma.checkoutLinkOpen.count({ where: { linkId: made.id } })).toBe(0);

      await prisma.productStock.updateMany({ where: { productId: target.id }, data: { quantity: 3 } });
      const back = await service.open(FIXTURE_KEYS.orgHandle, made.token, cart);
      if (back.kind !== "opened") throw new Error(back.kind);
      expect(back.lines.map((l) => l.productId)).toEqual([target.id]);
    });

    it("a link for a product sold in sizes asks for one among the sizes in stock, and adds the size picked (D6)", async () => {
      const familyName = unique();
      const family = await prisma.productFamily.create({ data: { orgId: fx.orgId, name: familyName } });
      const small = await product(99_900, 0, fx.orgId, `${familyName}-a-S`, family.id);
      const medium = await product(99_900, 4, fx.orgId, `${familyName}-b-M`, family.id);
      const large = await product(109_900, 4, fx.orgId, `${familyName}-c-L`, family.id);
      const unrelated = await product(10_000, 5);
      const link = await make([{ productId: medium.id, quantity: 1, pickSize: true }]);

      const stored = await prisma.checkoutLink.findUniqueOrThrow({ where: { id: link.id } });
      expect(stored.displayPricesPaise).toMatchObject({ [large.id]: 109_900, [medium.id]: 99_900 });

      const resolved = await service.resolve(FIXTURE_KEYS.orgHandle, link.token);
      if (resolved.kind !== "live") throw new Error(resolved.kind);
      expect(resolved.sizeSteps).toEqual([
        { productId: medium.id, options: [expect.objectContaining({ productId: medium.id }), expect.objectContaining({ productId: large.id })] },
      ]);
      expect(resolved.sizeSteps[0].options.map((o) => o.productId)).not.toContain(small.id);

      const opened = await service.open(FIXTURE_KEYS.orgHandle, link.token, `device:${unique()}`, new Date(), [large.id]);
      if (opened.kind !== "opened") throw new Error(opened.kind);
      expect(opened.lines.map((l) => [l.productId, l.price, l.fromLinkId])).toEqual([[large.id, 109_900, link.id]]);

      // A pick that is not one of the family's sizes is ignored: the link's own item is added.
      const forged = await service.open(FIXTURE_KEYS.orgHandle, link.token, `device:${unique()}`, new Date(), [unrelated.id, small.id]);
      if (forged.kind !== "opened") throw new Error(forged.kind);
      expect(forged.lines.map((l) => l.productId)).toEqual([medium.id]);

      // Checkout counts the picked size as the link's item, and prices it against its own snapshot.
      await prisma.product.update({ where: { id: large.id }, data: { price: 104_900 } });
      const [note] = await service.notes([{ linkId: link.id, productIds: [large.id] }]);
      expect(note.leftOut).toEqual([]);
      expect(note.priceChanges).toEqual([{ productId: large.id, nowPaise: 104_900, wasPaise: 109_900 }]);
    });

    it("a product in no family has no size to pick: the link opens as it is (D6)", async () => {
      const kurta = await product(129_900, 5);
      const link = await make([{ productId: kurta.id, quantity: 1, pickSize: true }]);
      expect(await service.resolve(FIXTURE_KEYS.orgHandle, link.token)).toEqual({ kind: "live", linkId: link.id, sizeSteps: [] });
    });
  });
});
