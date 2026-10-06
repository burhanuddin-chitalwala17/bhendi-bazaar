/**
 * Archiving, against a real database (ADR-0029, docs/specs/product-archive/).
 *
 * The claims worth testing here are claims about what Postgres returns and refuses:
 * that an archived product vanishes from every buyer-facing query, that the order
 * transaction refuses it even though a listing filter would already have hidden it,
 * that an order which already names it is untouched, and that a restore undoes all of
 * it. A stubbed repository would "prove" any of that regardless of whether the filters
 * are actually on the queries — which is the only thing that can go wrong.
 *
 * Same bargain as `bidding-concurrency.test.ts`: local development database, or skip.
 */
import "dotenv/config";
import { afterAll, describe, expect, it } from "vitest";
import { ensureFixtures, ensureOrgMember, isDisposableDb } from "../helpers/test-db";


const created = { products: [] as string[], orders: [] as string[] };

describe.skipIf(!isDisposableDb)("product archive (local db)", () => {
  async function seedFacts() {
    const fixtures = await ensureFixtures();
    const member = await ensureOrgMember(fixtures.orgId, fixtures.userId);
    return {
      location: { id: fixtures.orgAddressId, orgId: fixtures.orgId },
      category: { id: fixtures.categoryId, slug: fixtures.categorySlug },
      member,
    };
  }

  async function makeProduct(overrides: { sku?: string } = {}) {
    const { prisma } = await import("@server/shared/prisma");
    const { location, category } = await seedFacts();
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const product = await prisma.product.create({
      data: {
        slug: `archive-test-${suffix}`,
        name: `Archive test ${suffix}`,
        description: "Created by tests/integration/product-archive.test.ts",
        price: 150_000,
        categoryId: category.id,
        orgId: location.orgId,
        thumbnail: "https://placehold.co/600x600",
        flags: ["HERO"],
        sku: overrides.sku,
        stockLocations: { create: { orgAddressId: location.id, quantity: 5 } },
      },
      select: { id: true, slug: true, name: true, orgId: true },
    });
    created.products.push(product.id);
    return product;
  }

  /** An actor for the org portal, as `resolveOrgScope` would produce one. */
  async function actorFor(orgId: string) {
    const { userId } = await ensureFixtures();
    const member = await ensureOrgMember(orgId, userId);
    return { orgId, userId: member.userId };
  }

  afterAll(async () => {
    const { prisma } = await import("@server/shared/prisma");
    for (const id of created.orders) {
      await prisma.order.delete({ where: { id } }).catch(() => {});
    }
    for (const id of created.products) {
      await prisma.adminLog
        .deleteMany({ where: { resource: "Product", resourceId: id } })
        .catch(() => {});
      await prisma.product.delete({ where: { id } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  it("removes an archived product from every buyer-facing read, and a restore puts it back", async () => {
    const { productsRepository } = await import("@server/catalog/product.read.repository");
    const { productsService } = await import("@server/catalog/admin.product.service");
    const product = await makeProduct();
    const actor = await actorFor(product.orgId);

    const visible = async () => ({
      bySlug: (await productsRepository.getProductBySlug(product.slug)) !== null,
      byId: (await productsRepository.getProductById(product.id)) !== null,
      inSearch: (await productsRepository.searchProducts(product.name, 20)).some(
        (p) => p.id === product.id
      ),
      inHero: (await productsRepository.getHeroProducts(200)).some((p) => p.id === product.id),
      inSitemap: (await productsRepository.listSlugs()).some((s) => s.slug === product.slug),
      inPicker: (
        await productsRepository.listForPicker({ orgId: product.orgId, limit: 500 })
      ).products.some((p) => p.id === product.id),
    });

    expect(await visible()).toEqual({
      bySlug: true, byId: true, inSearch: true, inHero: true, inSitemap: true, inPicker: true,
    });

    await productsService.archiveProduct(product.id, actor);

    expect(await visible()).toEqual({
      bySlug: false, byId: false, inSearch: false, inHero: false, inSitemap: false, inPicker: false,
    });

    await productsService.restoreProduct(product.id, actor);

    expect(await visible()).toEqual({
      bySlug: true, byId: true, inSearch: true, inHero: true, inSitemap: true, inPicker: true,
    });
  });

  it("refuses a purchase inside the transaction, not merely in the listing", async () => {
    const { assertNotArchived } = await import("@server/catalog/product.sale-gate");
    const { productsService } = await import("@server/catalog/admin.product.service");
    const product = await makeProduct();
    const actor = await actorFor(product.orgId);

    // On sale: the gate lets it through.
    await expect(assertNotArchived([product.id])).resolves.toBeUndefined();

    await productsService.archiveProduct(product.id, actor);

    // Archived: refused by name, which is what the buyer is shown.
    await expect(assertNotArchived([product.id])).rejects.toThrow(/no longer available/i);
    await expect(assertNotArchived([product.id])).rejects.toThrow(product.name);
  });

  it("still lets the org find and restore it, which is why the portal read is unfiltered", async () => {
    const { adminProductsRepository } = await import("@server/catalog/product.repository");
    const { productsService } = await import("@server/catalog/admin.product.service");
    const product = await makeProduct();
    const actor = await actorFor(product.orgId);
    await productsService.archiveProduct(product.id, actor);

    const detail = await adminProductsRepository.getProductById(product.id);
    expect(detail?.archivedAt).toBeInstanceOf(Date);

    const onSale = await adminProductsRepository.getProducts({ orgId: product.orgId, limit: 500 });
    expect(onSale.products.some((p) => p.id === product.id)).toBe(false);

    const archivedShelf = await adminProductsRepository.getProducts({
      orgId: product.orgId,
      shelf: "archived",
      limit: 500,
    });
    expect(archivedShelf.products.some((p) => p.id === product.id)).toBe(true);
  });

  it("reports an archived product as unavailable rather than unknown, keeping its name", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { productsService } = await import("@server/catalog/admin.product.service");
    const product = await makeProduct();
    const actor = await actorFor(product.orgId);
    await productsService.archiveProduct(product.id, actor);

    // What the check-stock handler reads. Its own branch is unit-tested; this pins
    // that the column is actually there to branch on.
    const row = await prisma.product.findFirst({
      where: { id: product.id },
      select: { name: true, archivedAt: true },
    });
    expect(row?.name).toBe(product.name);
    expect(row?.archivedAt).toBeInstanceOf(Date);
  });

  it("deletes a product nothing depends on, and refuses one an order needs", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { productsService } = await import("@server/catalog/admin.product.service");

    // Never ordered: deleted outright.
    const unsold = await makeProduct();
    const actor = await actorFor(unsold.orgId);
    await productsService.deleteProduct(unsold.id);
    expect(await prisma.product.findUnique({ where: { id: unsold.id } })).toBeNull();

    // Ordered: refused by name, and pointed at Archive. It used to archive silently;
    // now that Archive is its own control, one button doing two things was the bug.
    const sold = await makeProduct();
    const order = await prisma.order.create({
      data: {
        code: `BB-ARCH-${Date.now()}`,
        address: { line1: "test", pincode: "400003" },
        itemsTotal: 150_000,
        grandTotal: 150_000,
        items: {
          create: {
            productId: sold.id,
            quantity: 1,
            // The price as it stood at purchase — the fact archiving exists to protect.
            unitPrice: 150_000,
            thumbnail: "https://placehold.co/600x600",
          },
        },
      },
      select: { id: true },
    });
    created.orders.push(order.id);

    await expect(productsService.deleteProduct(sold.id)).rejects.toThrow(/1 order/);
    await expect(productsService.deleteProduct(sold.id)).rejects.toThrow(/Archive it instead/);

    // Refused means refused: the product is untouched, not quietly archived.
    const after = await prisma.product.findUnique({
      where: { id: sold.id },
      select: { archivedAt: true },
    });
    expect(after?.archivedAt).toBeNull();

    // And Archive, the action the refusal names, does work on it.
    await productsService.archiveProduct(sold.id, actor);

    const line = await prisma.orderItem.findFirst({
      where: { orderId: order.id },
      select: { unitPrice: true, product: { select: { name: true, archivedAt: true } } },
    });
    expect(line?.unitPrice).toBe(150_000);
    // The order still reaches its product, and still reports what was paid.
    expect(line?.product.name).toBe(sold.name);
    expect(line?.product.archivedAt).toBeInstanceOf(Date);
  });

  it("keeps the SKU reserved while archived, and says so", async () => {
    const { productsService } = await import("@server/catalog/admin.product.service");
    const sku = `ARCH-${Date.now()}`;
    const product = await makeProduct({ sku });
    const actor = await actorFor(product.orgId);
    const { location, category } = await seedFacts();
    await productsService.archiveProduct(product.id, actor);

    await expect(
      productsService.createProduct({
        name: `Reuse ${sku}`,
        description: "should be refused",
        price: 100,
        orgId: product.orgId,
        categoryId: category.id,
        sku,
        weight: 0.5,
        media: [{ kind: "IMAGE", ref: "https://placehold.co/600x600", isThumbnail: true }],
        stockLocations: [{ orgAddressId: location.id, quantity: 1 }],
      })
    ).rejects.toThrow(/archived/i);
  });

  it("records who archived it, in the same transaction as the archiving", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { productsService } = await import("@server/catalog/admin.product.service");
    const product = await makeProduct();
    const actor = await actorFor(product.orgId);

    await productsService.archiveProduct(product.id, actor);
    await productsService.restoreProduct(product.id, actor);

    const trail = await prisma.adminLog.findMany({
      where: { resource: "Product", resourceId: product.id },
      select: { action: true, adminId: true },
      orderBy: { createdAt: "asc" },
    });
    expect(trail.map((entry) => entry.action)).toEqual([
      "PRODUCT_ARCHIVED",
      "PRODUCT_RESTORED",
    ]);
    expect(trail.every((entry) => entry.adminId === actor.userId)).toBe(true);
  });

  it("is idempotent, so a repeated archive is the asked-for state rather than an error", async () => {
    const { productsService } = await import("@server/catalog/admin.product.service");
    const product = await makeProduct();
    const actor = await actorFor(product.orgId);

    const first = await productsService.archiveProduct(product.id, actor);
    const second = await productsService.archiveProduct(product.id, actor);
    expect(second.archivedAt).toEqual(first.archivedAt);
  });

  it("refuses to archive a product with a live bidding event", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { productsService } = await import("@server/catalog/admin.product.service");
    const product = await makeProduct();
    const actor = await actorFor(product.orgId);

    const event = await prisma.biddingEvent.create({
      data: {
        productId: product.id,
        orgId: product.orgId,
        slug: `archive-bid-${Date.now()}`,
        startAt: new Date(Date.now() - 60_000),
        endAt: new Date(Date.now() + 600_000),
        startingBidPaise: 100_000,
        maxIncreasePaise: 50_000,
        quickBidsPaise: [1_000],
        referencePricePaise: 150_000,
        createdById: actor.userId,
      },
      select: { id: true },
    });

    try {
      await expect(productsService.archiveProduct(product.id, actor)).rejects.toThrow(
        /bidding event/i
      );
    } finally {
      await prisma.biddingEvent.delete({ where: { id: event.id } }).catch(() => {});
    }
  });
});
