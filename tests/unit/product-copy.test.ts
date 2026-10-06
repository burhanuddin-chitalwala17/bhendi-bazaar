/**
 * Copying a product (copy-product spec).
 *
 * `copyFrom` is a query string, so it is caller-controlled: naming another org's product
 * must read as not-found, and must never carry that product onto this org's form. The
 * copy must also leave behind what identifies or values one specific item — name, price,
 * SKU, media, stock — or it makes a duplicate rather than a sibling.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@server/shared/domain-error";

const getProductById = vi.fn();
const listCopyOptions = vi.fn();

// Neighbouring modules import the client at load; nothing on the copy path queries it.
vi.mock("@server/shared/prisma", () => ({ prisma: {} }));
vi.mock("@server/catalog/product.repository", () => ({
  adminProductsRepository: {
    getProductById: (id: string) => getProductById(id),
    listCopyOptions: (orgId: string) => listCopyOptions(orgId),
  },
}));

const { productsService } = await import("@server/catalog/admin.product.service");
const { adminProductsDAL } = await import("@/data-access-layer/admin/products.dal");

const source = {
  id: "p-1",
  name: "Velvet Kurta",
  slug: "velvet-kurta",
  description: "Hand-embroidered velvet.",
  price: 249900,
  sku: "VEK-001",
  categoryId: "c-1",
  category: { id: "c-1", name: "Kurtas" },
  org: { id: "org-1", name: "Shop", code: "SHP" },
  tags: ["festive"],
  flags: ["NEW_ARRIVAL"],
  media: [{ id: "m-1", kind: "IMAGE", ref: "https://img/1.webp", isThumbnail: true }],
  stockLocations: [{ orgAddressId: "a-1", quantity: 5, orgAddress: { name: "Main" } }],
  weight: 400,
};

beforeEach(() => {
  getProductById.mockReset().mockResolvedValue(source);
  listCopyOptions.mockReset().mockResolvedValue([]);
});

describe("getCopySource", () => {
  it("carries description, category, tags and flags — and nothing else", async () => {
    expect(await productsService.getCopySource("p-1", "org-1")).toEqual({
      id: "p-1",
      name: "Velvet Kurta",
      description: "Hand-embroidered velvet.",
      categoryId: "c-1",
      tags: ["festive"],
      flags: ["NEW_ARRIVAL"],
    });
  });

  it("refuses another org's product as not-found", async () => {
    await expect(productsService.getCopySource("p-1", "org-2")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("refuses an unknown id as not-found", async () => {
    getProductById.mockResolvedValue(null);
    await expect(productsService.getCopySource("nope", "org-1")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("the page's read", () => {
  it("falls back to a blank form rather than an error page", async () => {
    expect(await adminProductsDAL.getCopySource("p-1", "org-2")).toBeNull();
  });

  it("scopes the picker to the org in the path", async () => {
    await adminProductsDAL.getCopyOptions("org-1");
    expect(listCopyOptions).toHaveBeenCalledWith("org-1");
  });
});

describe("the picker's search", async () => {
  const { matchesCopyQuery } = await import(
    "@/components/product/console/productAdd/CopyFromPicker"
  );
  const kurta = { id: "p-1", name: "Velvet Embroidered Kurta", sku: "VEK-001" };
  const attar = { id: "p-2", name: "Royal Oud Attar", sku: null };

  it("matches the name case-insensitively, anywhere in it", () => {
    expect(matchesCopyQuery(kurta, "EMBROID")).toBe(true);
    expect(matchesCopyQuery(attar, "oud")).toBe(true);
  });

  it("matches the SKU, and a product without one never matches on SKU", () => {
    expect(matchesCopyQuery(kurta, "vek-0")).toBe(true);
    expect(matchesCopyQuery(attar, "vek")).toBe(false);
  });

  it("treats a blank or whitespace query as no filter", () => {
    expect(matchesCopyQuery(attar, "   ")).toBe(true);
  });
});
