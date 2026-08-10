// The stale-thumbnail bug: `thumbnail` is a column of its own, and the edit form only
// auto-set it when blank, so editing a product's gallery left every listing card on the
// old picture. The rule pinned here is the one the upload control already advertises
// with its "Thumbnail" badge on images[0] — the first gallery image IS the thumbnail.
import { describe, expect, it } from "vitest";
import { deriveThumbnail } from "@server/catalog/admin.product.service";
import type { ProductFormInput } from "@server/catalog/admin.product.types";

const NEW = "https://cdn.example.com/new.jpg";
const OLD = "https://cdn.example.com/old.jpg";

const form = (overrides: Partial<ProductFormInput> = {}): ProductFormInput => ({
  name: "Cream Rida",
  description: "A lightweight cream rida.",
  price: 120000,
  salePrice: undefined,
  currency: "INR",
  categoryId: "cat_1",
  orgId: "sel_1",
  tags: [],
  flags: [],
  images: [NEW],
  thumbnail: NEW,
  weight: 0.5,
  sizes: [],
  colors: [],
  stockLocations: [{ orgAddressId: "loc_1", quantity: 5 }],
  sku: "",
  lowStockThreshold: 10,
  ...overrides,
});

describe("deriveThumbnail", () => {
  // The reported bug: a new image was added in front of the old one, which stayed in
  // the gallery. Any "is it still one of the images" check passes here and does nothing.
  it("promotes the new first image even when the old thumbnail is still in the gallery", () => {
    const data = form({ images: [NEW, OLD], thumbnail: OLD });
    expect(deriveThumbnail(data).thumbnail).toBe(NEW);
  });

  it("replaces a thumbnail that was removed from the gallery outright", () => {
    const data = form({ images: [NEW], thumbnail: OLD });
    expect(deriveThumbnail(data).thumbnail).toBe(NEW);
  });

  it("leaves an already-correct payload untouched", () => {
    const data = form({ images: [NEW, OLD], thumbnail: NEW });
    expect(deriveThumbnail(data)).toBe(data);
  });

  it("follows a reorder — the promoted image becomes the thumbnail", () => {
    const data = form({ images: [OLD, NEW], thumbnail: NEW });
    expect(deriveThumbnail(data).thumbnail).toBe(OLD);
  });
});
