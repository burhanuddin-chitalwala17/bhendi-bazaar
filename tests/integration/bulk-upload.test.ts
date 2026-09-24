/**
 * Database-dependent halves of bulk upload (bulk-catalog-upload R3/R4/R5):
 * SKU uniqueness is org-scoped, validation names real conflicts, and creation
 * is all-or-nothing. Runs against the seeded local database; cleans up after
 * itself; skips anywhere else.
 */
import "dotenv/config";
import { describe, it, expect, afterAll } from "vitest";
import { ensureFixtures, isDisposableDb } from "../helpers/test-db";


const TEST_SKU = "BULK-TEST-SKU-001";
const TEST_PREFIX = "bulk-test-";
const BLOB = "https://test.public.blob.vercel-storage.com/products/x/y/z.jpg";

describe.skipIf(!isDisposableDb)("bulk upload (local seeded db)", () => {
  afterAll(async () => {
    const { prisma } = await import("@server/shared/prisma");
    await prisma.product.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
  });

  it("the same SKU is legal in two orgs and refused within one (R4)", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { orgId, otherOrgId, categoryId } = await ensureFixtures();
    const orgs = [{ id: orgId }, { id: otherOrgId }];
    // The whole claim is "two orgs". If the fixture ever handed back one org twice, both
    // creates below would hit the same uniqueness scope and the test would quietly invert.
    expect(orgId).not.toBe(otherOrgId);
    const template = { categoryId, thumbnail: "https://example.invalid/x.webp" };
    const base = {
      name: `${TEST_PREFIX}same-sku`,
      description: "t",
      price: 100,
      currency: "INR",
      categoryId: template.categoryId,
      thumbnail: template.thumbnail,
      weight: 1,
      sku: TEST_SKU,
    };
    await prisma.product.create({
      data: { ...base, slug: `${TEST_PREFIX}sku-a`, orgId: orgs[0].id },
    });
    // Different org, same SKU: fine now, impossible before this feature.
    await expect(
      prisma.product.create({
        data: { ...base, slug: `${TEST_PREFIX}sku-b`, orgId: orgs[1].id },
      })
    ).resolves.toBeTruthy();
    // Same org, same SKU: still refused.
    await expect(
      prisma.product.create({
        data: { ...base, slug: `${TEST_PREFIX}sku-c`, orgId: orgs[0].id },
      })
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("validation names the product already wearing a SKU, and the sheet row repeating one", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { validateProductRows } = await import("@server/catalog/bulk/bulk-product.service");
    const existing = await prisma.product.findFirstOrThrow({
      where: { sku: TEST_SKU },
      select: { orgId: true, category: { select: { slug: true } } },
    });
    const row = (sku: string) => ({
      name: "x",
      description: "d",
      price: 10,
      categorySlug: existing.category.slug,
      sku,
      weight: 1,
      sizes: [],
      colors: [],
      tags: [],
      images: ["a.jpg"],
      stock: {},
    });
    const errors = await validateProductRows(
      existing.orgId,
      [
        { rowNumber: 2, row: row(TEST_SKU) },
        { rowNumber: 3, row: row("BULK-FRESH-1") },
        { rowNumber: 4, row: row("BULK-FRESH-1") },
      ],
      ["a.jpg"]
    );
    expect(errors).toContainEqual(
      expect.objectContaining({ row: 2, field: "sku", message: expect.stringContaining("already used by") })
    );
    expect(errors).toContainEqual(
      expect.objectContaining({ row: 4, field: "sku", message: expect.stringContaining("row 3") })
    );
  });

  it("two products may each have their own front.jpg, named by folder (R2)", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { validateProductRows } = await import("@server/catalog/bulk/bulk-product.service");
    const { orgId: org0, categorySlug } = await ensureFixtures();
    const org = { id: org0 };
    const category = { slug: categorySlug };
    const row = (name: string, images: string[]) => ({
      name,
      description: "d",
      price: 10,
      categorySlug: category.slug,
      weight: 1,
      sizes: [],
      colors: [],
      tags: [],
      images,
      stock: {},
    });
    const uploaded = ["photos/abaya/front.jpg", "photos/attar/front.jpg"];

    // Folder-qualified: both rows resolve, no error.
    expect(
      await validateProductRows(
        org.id,
        [
          { rowNumber: 2, row: row("a", ["abaya/front.jpg"]) },
          { rowNumber: 3, row: row("b", ["attar/front.jpg"]) },
        ],
        uploaded
      )
    ).toEqual([]);

    // Bare and colliding: refused, not silently pointed at one of them.
    const errors = await validateProductRows(
      org.id,
      [{ rowNumber: 2, row: row("a", ["front.jpg"]) }],
      uploaded
    );
    expect(errors).toContainEqual(
      expect.objectContaining({
        row: 2,
        field: "images",
        message: expect.stringContaining("matches 2 uploaded files"),
      })
    );
  });

  it("creation is all-or-nothing: one doomed row creates zero products (R3)", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { createProducts } = await import("@server/catalog/bulk/bulk-product.service");
    // An org that actually has a pickup location — picked explicitly, because
    // "whichever org came back first" is how a test starts failing on Tuesdays.
    const fixtures = await ensureFixtures();
    const location = await prisma.orgAddress.findUniqueOrThrow({
      where: { id: fixtures.orgAddressId },
      select: { name: true, orgId: true },
    });
    const category = { slug: fixtures.categorySlug, id: fixtures.categoryId };
    const template = { thumbnail: "https://example.invalid/x.webp" };
    const doomedSku = "BULK-TEST-DOOMED";
    await prisma.product.create({
      data: {
        name: `${TEST_PREFIX}sku-holder`,
        slug: `${TEST_PREFIX}sku-holder`,
        description: "t",
        price: 100,
        currency: "INR",
        categoryId: category.id,
        thumbnail: template.thumbnail,
        weight: 1,
        sku: doomedSku,
        orgId: location.orgId,
      },
    });

    const row = (name: string, sku?: string) => ({
      name,
      description: "d",
      price: 10,
      categorySlug: category.slug,
      sku,
      weight: 1,
      sizes: [],
      colors: [],
      tags: [],
      images: ["a.jpg"],
      stock: { [location.name]: 3 },
      imageUrls: { "a.jpg": BLOB },
    });

    const before = await prisma.product.count();
    await expect(
      createProducts(location.orgId, [
        { rowNumber: 2, row: row(`${TEST_PREFIX}good-row`) },
        { rowNumber: 3, row: row(`${TEST_PREFIX}doomed-row`, doomedSku) },
      ])
    ).rejects.toMatchObject({ name: "ConflictError" });
    // The good row did not land either — that is what all-or-nothing means.
    expect(await prisma.product.count()).toBe(before);
  });

  it("a clean sheet creates products with media, stock and paise prices", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { createProducts } = await import("@server/catalog/bulk/bulk-product.service");
    const fixtures = await ensureFixtures();
    const location = await prisma.orgAddress.findUniqueOrThrow({
      where: { id: fixtures.orgAddressId },
      select: { name: true, orgId: true },
    });
    const category = await prisma.category.findFirstOrThrow({ select: { slug: true } });
    const result = await createProducts(location.orgId, [
      {
        rowNumber: 2,
        row: {
          name: `${TEST_PREFIX}clean`,
          description: "d",
          price: 499.5,
          categorySlug: category.slug,
          weight: 0.5,
          sizes: ["M"],
          colors: [],
          tags: ["test"],
          images: ["a.jpg", "b.jpg"],
          cover: "b.jpg",
          videoRef: "dQw4w9WgXcQ",
          stock: { [location.name]: 7 },
          imageUrls: { "a.jpg": BLOB, "b.jpg": BLOB.replace("z.jpg", "b.jpg") },
        },
      },
    ]);
    expect(result.created).toBe(1);
    const product = await prisma.product.findFirstOrThrow({
      where: { name: `${TEST_PREFIX}clean` },
      include: { media: { orderBy: { position: "asc" } }, stockLocations: true },
    });
    expect(product.price).toBe(49950); // rupees converted once, to integer paise
    expect(product.slug).toBe("bulk-test-clean"); // server-generated
    expect(product.thumbnail).toContain("b.jpg"); // the named cover
    expect(product.media.map((m) => m.kind)).toEqual(["IMAGE", "IMAGE", "YOUTUBE"]);
    expect(product.media.find((m) => m.isThumbnail)?.ref).toContain("b.jpg");
    expect(product.stockLocations[0]?.quantity).toBe(7);
  });
});
