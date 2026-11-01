/**
 * A save is a compare-and-set on the product's version (product-form D6, D7; spec R9, A6): a
 * second save from the version the first one already moved past writes nothing — no field, no
 * stock row, no gallery row — and the refusal names who saved and when.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";

describe.skipIf(!isDisposableDb)("product edit version (local db)", () => {
  let prisma: typeof import("@server/shared/prisma").prisma;
  let productsService: typeof import("@server/catalog/admin.product.service").productsService;
  let fixtures: Awaited<ReturnType<typeof ensureFixtures>>;
  let memberId: string;
  const ids: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import("@server/shared/prisma"));
    ({ productsService } = await import("@server/catalog/admin.product.service"));
    fixtures = await ensureFixtures();
    const member = await prisma.user.upsert({
      where: { email: "product-edit-version-member@fixtures.test" },
      update: {},
      create: { name: "Zahra Member", email: "product-edit-version-member@fixtures.test" },
      select: { id: true },
    });
    memberId = member.id;
  });

  afterAll(async () => {
    if (prisma) await prisma.product.deleteMany({ where: { id: { in: ids } } });
  });

  async function aProduct() {
    const created = await productsService.createProduct({
      name: `Version test ${Date.now().toString(36)}`,
      description: "Created by tests/integration/product-edit-version.test.ts",
      price: 2499,
      orgId: fixtures.orgId,
      categoryId: fixtures.categoryId,
      weight: 0.6,
      media: [{ kind: "IMAGE", ref: "https://placehold.co/600x600", isThumbnail: true }],
      stockLocations: [{ orgAddressId: fixtures.orgAddressId, quantity: 5 }],
    });
    ids.push(created.id);
    return created.id;
  }

  /** The edit form's payload, opened at `seenVersion`, with `change` laid over it. */
  const edit = (id: string, seenVersion: number, change: { name?: string; price?: number; quantity?: number }) =>
    ({
      name: change.name ?? "Unchanged",
      description: "Created by tests/integration/product-edit-version.test.ts",
      price: change.price ?? 2499,
      orgId: fixtures.orgId,
      categoryId: fixtures.categoryId,
      weight: 0.6,
      media: [{ kind: "IMAGE" as const, ref: "https://placehold.co/600x600", isThumbnail: true }],
      stockLocations: [{ orgAddressId: fixtures.orgAddressId, quantity: change.quantity ?? 5, seenQuantity: 5 }],
      seenVersion,
    });

  const row = (id: string) =>
    prisma.product.findUniqueOrThrow({
      where: { id },
      select: {
        name: true,
        price: true,
        version: true,
        lastEditedById: true,
        teamEditedAt: true,
        stockLocations: { select: { quantity: true } },
      },
    });

  it("a second save from the same version writes nothing and names the member who saved (spec A6)", async () => {
    const id = await aProduct();
    await productsService.updateProduct(id, edit(id, 0, { name: "First save", price: 2299 }), { userId: memberId, team: false });
    expect(await row(id)).toMatchObject({ name: "First save", price: 229_900, version: 1, lastEditedById: memberId, teamEditedAt: null });

    // The other tab opened at version 0 too, and changes the name, price and stock.
    const refused = productsService.updateProduct(id, edit(id, 0, { name: "Stale save", price: 1999, quantity: 9 }), {
      userId: fixtures.userId,
      team: false,
    });
    await expect(refused).rejects.toMatchObject({
      name: "ConflictError",
      message: expect.stringMatching(/^Zahra Member changed this product just now\. We loaded the latest/),
    });

    const after = await row(id);
    expect(after).toMatchObject({ name: "First save", price: 229_900, version: 1, lastEditedById: memberId });
    expect(after.stockLocations).toEqual([{ quantity: 5 }]);
  });

  it("a team save marks the product and names the team; the shop's next save clears the mark (D7)", async () => {
    const id = await aProduct();
    await productsService.updateProduct(id, edit(id, 0, { price: 2299 }), { userId: fixtures.userId, team: true });
    expect((await row(id)).teamEditedAt).not.toBeNull();

    await expect(
      productsService.updateProduct(id, edit(id, 0, { price: 1999 }), { userId: memberId, team: false }),
    ).rejects.toMatchObject({ message: expect.stringMatching(/^Bhendi Bazaar team changed this product just now\./) });

    await productsService.updateProduct(id, edit(id, 1, { price: 1999 }), { userId: memberId, team: false });
    expect(await row(id)).toMatchObject({ price: 199_900, version: 2, lastEditedById: memberId, teamEditedAt: null });
  });
});
