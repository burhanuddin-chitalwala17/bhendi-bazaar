/**
 * The pure parts of bulk catalogue upload: sheet-row parsing (Zod), the blob
 * path builder, video/cover rules. Database-dependent checks live in
 * tests/integration/bulk-upload.test.ts.
 */
import { describe, it, expect } from "vitest";
import { parseBulkProductRow } from "@/lib/validation/schemas/bulk-product.schema";
import { parseBulkCategoryRow } from "@/lib/validation/schemas/bulk-category.schema";
import { buildImagePath, sanitizeIdentifier } from "@server/catalog/image-upload";
import type { RawSheetRow } from "@server/catalog/bulk/sheet";

const raw = (cells: Record<string, string>, rowNumber = 2): RawSheetRow => ({ rowNumber, cells });

const validCells = {
  name: "Emerald Silk Abaya",
  description: "Hand-finished silk.",
  price: "2499",
  category: "Abayas",
  sku: "ABAYA-001",
  weight: "0.6",
  sizes: "S;M;L",
  colors: "Emerald; Black",
  tags: "abaya;silk",
  images: "front.jpg; back.jpg",
  cover: "front.jpg",
  video: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "stock:Main shop": "12",
  "stock:Godown": "0",
};

describe("parseBulkProductRow", () => {
  it("parses a full row, splitting lists and matching stock columns", () => {
    const parsed = parseBulkProductRow(raw(validCells));
    expect("row" in parsed).toBe(true);
    if (!("row" in parsed)) return;
    expect(parsed.row.name).toBe("Emerald Silk Abaya");
    expect(parsed.row.categorySlug).toBe("abayas");
    expect(parsed.row.sizes).toEqual(["S", "M", "L"]);
    expect(parsed.row.colors).toEqual(["Emerald", "Black"]);
    expect(parsed.row.images).toEqual(["front.jpg", "back.jpg"]);
    expect(parsed.row.videoRef).toBe("dQw4w9WgXcQ");
    expect(parsed.row.stock).toEqual({ "Main shop": 12, Godown: 0 });
  });

  it("keeps price in rupees for the service to convert once (Invariant 3)", () => {
    const parsed = parseBulkProductRow(raw({ ...validCells, price: "499.50" }));
    if (!("row" in parsed)) throw new Error("expected a row");
    expect(parsed.row.price).toBe(499.5);
  });

  it("rejects a bad video URL as a row error naming the field", () => {
    const parsed = parseBulkProductRow(raw({ ...validCells, video: "https://vimeo.com/12345" }, 7));
    if (!("errors" in parsed)) throw new Error("expected errors");
    expect(parsed.errors).toContainEqual(
      expect.objectContaining({ row: 7, field: "video" })
    );
  });

  it("collects every problem on a broken row at once (R3)", () => {
    const parsed = parseBulkProductRow(
      raw({ name: "x", description: "", price: "-5", category: "", images: "" }, 3)
    );
    if (!("errors" in parsed)) throw new Error("expected errors");
    const fields = parsed.errors.map((e) => e.field);
    for (const f of ["name", "description", "price", "categorySlug", "weight", "images"]) {
      expect(fields).toContain(f);
    }
    expect(parsed.errors.every((e) => e.row === 3)).toBe(true);
  });

  it("has no column through which server-owned fields could arrive (R8)", () => {
    const parsed = parseBulkProductRow(
      raw({ ...validCells, slug: "hacked", rating: "5", flags: "HERO" })
    );
    if (!("row" in parsed)) throw new Error("expected a row");
    expect(parsed.row).not.toHaveProperty("slug");
    expect(parsed.row).not.toHaveProperty("rating");
    expect(parsed.row).not.toHaveProperty("flags");
  });
});

describe("parseBulkCategoryRow", () => {
  it("parses parent and accent, lower-casing the parent slug", () => {
    const parsed = parseBulkCategoryRow(
      raw({ name: "Silk Abayas", description: "d", parent: "Abayas", accent: "purple", image: "hero.jpg" })
    );
    if (!("row" in parsed)) throw new Error("expected a row");
    expect(parsed.row.parent).toBe("abayas");
    expect(parsed.row.accent).toBe("PURPLE");
  });

  it("rejects an unknown accent with a row error", () => {
    const parsed = parseBulkCategoryRow(
      raw({ name: "Silk", description: "d", accent: "TEAL", image: "hero.jpg" }, 4)
    );
    if (!("errors" in parsed)) throw new Error("expected errors");
    expect(parsed.errors[0]).toMatchObject({ row: 4, field: "accent" });
  });
});

describe("buildImagePath", () => {
  it("nests product images under org and product (D4)", () => {
    expect(buildImagePath("products", "Front View.JPG", "Emerald Abaya", "SEL-001", 1000)).toBe(
      "products/sel-001/emerald-abaya/front-view-1000.jpg"
    );
  });

  it("keeps categories un-orged and falls back rather than crashing", () => {
    expect(buildImagePath("categories", "hero.png", "Abayas", null, 1000)).toBe(
      "categories/abayas/hero-1000.png"
    );
    expect(buildImagePath("products", "x.png", undefined, undefined, 1000)).toBe(
      "products/unnamed/unnamed/x-1000.png"
    );
  });

  it("sanitizes hostile names", () => {
    expect(sanitizeIdentifier("  ../../etc/passwd  ")).toBe("etc-passwd");
  });
});
