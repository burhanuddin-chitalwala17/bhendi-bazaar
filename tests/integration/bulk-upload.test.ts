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

  it("treats a SKU already in use as an update, and still refuses one repeated in the sheet", async () => {
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
      factLabels: {},
      measurements: {},
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
    // Row 2 names a live product's SKU, which is how a sheet says "update this one" rather
    // than a conflict (bulk-sheet). Row 4 repeats row 3's, which is still an error: two rows
    // cannot both be the same product.
    expect(errors.filter((error) => error.row === 2)).toEqual([]);
    expect(errors).toContainEqual(
      expect.objectContaining({ row: 4, field: "sku", message: "SKU BULK-FRESH-1 is used twice — rows 3 and 4" })
    );

    // own-store/bulk-sheet U3: two tabs share row numbers, so a repeat across them names both tabs,
    // and every problem carries the tab it sits on.
    const acrossTabs = await validateProductRows(
      existing.orgId,
      [
        { rowNumber: 5, tab: "Abaya", row: row("BULK-FRESH-2") },
        { rowNumber: 5, tab: "Attar", row: row("BULK-FRESH-2") },
      ],
      ["a.jpg"]
    );
    expect(acrossTabs).toContainEqual({
      row: 5,
      tab: "Attar",
      field: "sku",
      message: "SKU BULK-FRESH-2 is used twice — rows 5 (Abaya) and 5 (Attar)",
    });

    // And the plan says which it is, so a person sees it before confirming.
    const { planProductRows } = await import("@server/catalog/bulk/bulk-product.service");
    const plan = await planProductRows(existing.orgId, [
      { rowNumber: 2, row: row(TEST_SKU) },
      { rowNumber: 3, row: row("BULK-FRESH-1") },
    ]);
    expect(plan.updates.size).toBe(1);
    expect(plan.creates).toBe(1);
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
      factLabels: {},
      measurements: {},
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

  // own-store/bulk-sheet R5: the dry run checks every word the dropdowns offered, so a pasted
  // value is caught before anything is created (Q19), and a path reads as its category.
  it("R5 — reads a category by its path and refuses a slip, naming the closest", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { validateProductRows, createProducts } = await import("@server/catalog/bulk/bulk-product.service");
    const fixtures = await ensureFixtures();
    const category = await prisma.category.findUniqueOrThrow({ where: { id: fixtures.categoryId } });
    const parent = category.parentId
      ? await prisma.category.findUniqueOrThrow({ where: { id: category.parentId } })
      : null;
    const path = parent ? `${parent.name} › ${category.name}` : category.name;
    const row = (categorySlug: string, factLabels: Record<string, string> = {}) => ({
      name: `${TEST_PREFIX}path`, description: "d", price: 10, categorySlug, weight: 1,
      factLabels, measurements: {}, tags: [], images: ["a.jpg"], stock: {},
    });

    expect(await validateProductRows(fixtures.orgId, [{ rowNumber: 5, row: row(path.toUpperCase()) }], ["a.jpg"])).toEqual([]);

    const slip = `${path}x`;
    const errors = await validateProductRows(fixtures.orgId, [{ rowNumber: 5, row: row(slip) }], ["a.jpg"]);
    expect(errors).toContainEqual({
      row: 5,
      field: "category",
      message: `Category '${slip}' isn't in the list — pick from the dropdown. Did you mean '${path}'?`,
    });

    // Every listed word is checked in the dry run, not only at create.
    const facts = await validateProductRows(fixtures.orgId, [{ rowNumber: 6, row: row(path, { colour: "Zzzzzzzz" }) }], ["a.jpg"]);
    expect(facts).toContainEqual(expect.objectContaining({ row: 6, field: "colour" }));

    // A path-named row creates under that category.
    const { created } = await createProducts(fixtures.orgId, [
      { rowNumber: 5, row: { ...row(path), imageUrls: { "a.jpg": BLOB } } },
    ]);
    expect(created).toBe(1);
    const made = await prisma.product.findFirstOrThrow({ where: { name: `${TEST_PREFIX}path` } });
    expect(made.categoryId).toBe(category.id);
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
    // The row is doomed by an **archived** product's SKU, not a live one: a live SKU is now
    // how a sheet says "update this", so it is no longer a conflict. An archived product still
    // holds its code (ADR-0029), so creating against it violates the unique pair — which is
    // also why validation refuses such a row, asking for a restore or another code.
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
        archivedAt: new Date(),
      },
    });

    const row = (name: string, sku?: string) => ({
      name,
      description: "d",
      price: 10,
      categorySlug: category.slug,
      sku,
      weight: 1,
      factLabels: {},
      measurements: {},
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

  /**
   * The point of update-by-SKU: an existing catalogue is corrected in one upload rather than one
   * form at a time. What must survive is the slug — it is frozen at creation, because changing
   * one 404s every link to the product.
   */
  it("a row whose SKU matches a live product replaces it, keeping its slug", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { createProducts } = await import("@server/catalog/bulk/bulk-product.service");
    const fixtures = await ensureFixtures();
    const location = await prisma.orgAddress.findUniqueOrThrow({
      where: { id: fixtures.orgAddressId },
      select: { name: true, orgId: true },
    });

    const sku = `${TEST_PREFIX}update-me`;
    const before = await prisma.product.create({
      data: {
        name: `${TEST_PREFIX}old-name`,
        slug: `${TEST_PREFIX}frozen-slug`,
        description: "the old description",
        price: 10000,
        currency: "INR",
        categoryId: fixtures.categoryId,
        thumbnail: "https://example.invalid/old.webp",
        weight: 1,
        sku,
        orgId: location.orgId,
      },
      select: { id: true, slug: true },
    });

    const countBefore = await prisma.product.count();
    const result = await createProducts(location.orgId, [
      {
        rowNumber: 2,
        row: {
          name: `${TEST_PREFIX}new-name`,
          description: "the new description",
          price: 250,
          categorySlug: fixtures.categorySlug,
          sku,
          weight: 2,
          factLabels: {},
          measurements: {},
          tags: ["updated"],
          images: ["a.jpg"],
          stock: { [location.name]: 7 },
          imageUrls: { "a.jpg": BLOB },
        },
      },
    ]);

    expect(result).toEqual({ created: 0, updated: 1 });
    // No second product: an update replaces rather than adds.
    expect(await prisma.product.count()).toBe(countBefore);

    const after = await prisma.product.findUniqueOrThrow({
      where: { id: before.id },
      select: { name: true, slug: true, description: true, price: true, tags: true },
    });
    expect(after.name).toBe(`${TEST_PREFIX}new-name`);
    expect(after.description).toBe("the new description");
    expect(after.price).toBe(25000); // rupees to paise, once (Invariant 3)
    expect(after.tags).toEqual(["updated"]);
    // The one thing an update must not touch.
    expect(after.slug).toBe(before.slug);
  });

  it("an update replaces the gallery and the stock rather than adding to them", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { createProducts } = await import("@server/catalog/bulk/bulk-product.service");
    const fixtures = await ensureFixtures();
    const location = await prisma.orgAddress.findUniqueOrThrow({
      where: { id: fixtures.orgAddressId },
      select: { name: true, orgId: true },
    });
    const sku = `${TEST_PREFIX}replace-media`;
    const row = (name: string) => ({
      rowNumber: 2,
      row: {
        name,
        description: "d",
        price: 10,
        categorySlug: fixtures.categorySlug,
        sku,
        weight: 1,
        factLabels: {},
        measurements: {},
        tags: [],
        images: ["a.jpg"],
        stock: { [location.name]: 3 },
        imageUrls: { "a.jpg": BLOB },
      },
    });

    await createProducts(location.orgId, [row(`${TEST_PREFIX}media-first`)]);
    const created = await prisma.product.findFirstOrThrow({ where: { orgId: location.orgId, sku } });
    await createProducts(location.orgId, [row(`${TEST_PREFIX}media-second`)]);

    expect(await prisma.productMedia.count({ where: { productId: created.id } })).toBe(1);
    expect(await prisma.productStock.count({ where: { productId: created.id } })).toBe(1);
  });

  it("an update without a Brand column keeps the product's brand; a blank Brand cell clears it", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { createProducts } = await import("@server/catalog/bulk/bulk-product.service");
    const fixtures = await ensureFixtures();
    const location = await prisma.orgAddress.findUniqueOrThrow({
      where: { id: fixtures.orgAddressId },
      select: { name: true, orgId: true },
    });
    const sku = `${TEST_PREFIX}keep-brand`;
    const brand = await prisma.brand.create({ data: { orgId: location.orgId, name: `${TEST_PREFIX}${Date.now()}` } });
    const product = await prisma.product.create({
      data: {
        name: `${TEST_PREFIX}branded`,
        slug: `${TEST_PREFIX}branded-${Date.now()}`,
        description: "d",
        price: 1000,
        currency: "INR",
        categoryId: fixtures.categoryId,
        thumbnail: "https://example.invalid/b.webp",
        weight: 1,
        sku,
        orgId: location.orgId,
        brandId: brand.id,
      },
      select: { id: true },
    });
    const row = (brandName?: string) => ({
      rowNumber: 2,
      row: {
        name: `${TEST_PREFIX}branded`,
        description: "d",
        price: 10,
        categorySlug: fixtures.categorySlug,
        sku,
        weight: 1,
        factLabels: {},
        measurements: {},
        tags: [],
        images: ["a.jpg"],
        stock: {},
        imageUrls: { "a.jpg": BLOB },
        ...(brandName !== undefined ? { brandName } : {}),
      },
    });
    const brandOf = async () =>
      (await prisma.product.findUniqueOrThrow({ where: { id: product.id }, select: { brandId: true } })).brandId;

    try {
      await createProducts(location.orgId, [row()]);
      expect(await brandOf()).toBe(brand.id);
      await createProducts(location.orgId, [row("")]);
      expect(await brandOf()).toBeNull();
    } finally {
      await prisma.productMedia.deleteMany({ where: { productId: product.id } });
      await prisma.product.delete({ where: { id: product.id } });
      await prisma.brand.delete({ where: { id: brand.id } });
    }
  });

  it("a clean sheet creates products with media, stock and paise prices", async () => {
    const { prisma } = await import("@server/shared/prisma");
    const { createProducts } = await import("@server/catalog/bulk/bulk-product.service");
    const fixtures = await ensureFixtures();
    const location = await prisma.orgAddress.findUniqueOrThrow({
      where: { id: fixtures.orgAddressId },
      select: { name: true, orgId: true },
    });
    const category = { slug: fixtures.categorySlug };
    const result = await createProducts(location.orgId, [
      {
        rowNumber: 2,
        row: {
          name: `${TEST_PREFIX}clean`,
          description: "d",
          price: 499.5,
          categorySlug: category.slug,
          weight: 0.5,
          factLabels: {},
          measurements: {},
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
