/**
 * The WhatsApp catalogue's item builder and hash (social-selling/whatsapp-catalogue D1, D2). Pure,
 * and it decides what a buyer is shown and charged, so every branch is here.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@server/content/renditions.service", () => ({ renditionUrl: vi.fn() }));
const { buildCatalogueItem, catalogueItemHash, CATALOGUE_LEFT_OUT } = await import(
  "@server/channels/whatsapp-catalogue/item"
);
type CatalogueProduct = import("@server/channels/whatsapp-catalogue/item").CatalogueProduct;

const ORIGIN = "https://shop.example";
const real = (url: string) => ({ url, asset: { transform: null } });
const ai = (url: string) => ({ url, asset: { transform: { tool: "STYLED" } } });

const product = (over: Partial<CatalogueProduct> = {}): CatalogueProduct => ({
  id: "p1",
  slug: "black-abaya",
  name: "Black Abaya",
  description: "Nida, full length.",
  brand: "Al Noor",
  live: true,
  inStock: true,
  familyId: null,
  price: { pricePaise: 249950, offerPricePaise: 249950, offerLabel: null },
  photos: [real("https://img.example/a.jpg")],
  ...over,
});

const itemOf = (p: CatalogueProduct) => {
  const verdict = buildCatalogueItem(p, ORIGIN);
  if (verdict.kind !== "item") throw new Error(`left out: ${verdict.reason}`);
  return verdict.item;
};

describe("the item (D1)", () => {
  it("carries our product id, our product page and the list price in paise as Meta reads it (spec A1, R7)", () => {
    expect(itemOf(product())).toEqual({
      id: "p1",
      title: "Black Abaya",
      description: "Nida, full length.",
      availability: "in stock",
      condition: "new",
      price: "2499.50 INR",
      link: "https://shop.example/product/black-abaya",
      image_link: "https://img.example/a.jpg",
      additional_image_link: [],
      brand: "Al Noor",
    });
  });

  it("writes paise without a float, however small", () => {
    expect(itemOf(product({ price: { pricePaise: 5, offerPricePaise: 5, offerLabel: null } })).price).toBe("0.05 INR");
  });

  it("shows the offer price as the sale price with the list price beside it while an offer runs (spec A2, R2)", () => {
    const item = itemOf(product({ price: { pricePaise: 249900, offerPricePaise: 199900, offerLabel: "20% off" } }));
    expect(item.price).toBe("2499.00 INR");
    expect(item.sale_price).toBe("1999.00 INR");
  });

  it("has no sale price when no offer applies (spec R2)", () => {
    expect(itemOf(product())).not.toHaveProperty("sale_price");
  });

  it("is out of stock when the buy button says so, an auction hold included (spec A3, R3)", () => {
    expect(itemOf(product({ inStock: false })).availability).toBe("out of stock");
  });

  it("groups a family's members as one item with options (spec R7, Q12)", () => {
    expect(itemOf(product({ familyId: "fam-1" })).item_group_id).toBe("fam-1");
  });

  it("never makes an AI picture the main image; it follows the first real photograph (spec R8, Q14)", () => {
    const item = itemOf(product({ photos: [ai("https://img.example/ai.jpg"), real("https://img.example/r.jpg"), real("https://img.example/r2.jpg")] }));
    expect(item.image_link).toBe("https://img.example/r.jpg");
    expect(item.additional_image_link).toEqual(["https://img.example/ai.jpg", "https://img.example/r2.jpg"]);
  });

  it("keeps no more additional images than Meta takes", () => {
    const photos = Array.from({ length: 30 }, (_, i) => real(`https://img.example/${i}.jpg`));
    expect(itemOf(product({ photos })).additional_image_link).toHaveLength(20);
  });

  it("cuts a long name and description to Meta's limits by code point", () => {
    const item = itemOf(product({ name: "🧕".repeat(250), description: "a".repeat(12_000), brand: "b".repeat(150) }));
    expect(Array.from(item.title)).toHaveLength(200);
    expect(item.brand).toHaveLength(100);
    expect(item.description).toHaveLength(9999);
  });

  it("trims the description it sends", () => {
    expect(itemOf(product({ description: "  Nida.  " })).description).toBe("Nida.");
  });
});

describe("left out, with why (D1)", () => {
  const reason = (p: CatalogueProduct) => {
    const verdict = buildCatalogueItem(p, ORIGIN);
    return verdict.kind === "left_out" ? verdict.reason : null;
  };

  it("leaves out a product that is not live on the shop page (spec R1, R3)", () => {
    expect(reason(product({ live: false }))).toBe(CATALOGUE_LEFT_OUT.NOT_LIVE);
  });

  it("leaves out a product with no photo (spec R1)", () => {
    expect(reason(product({ photos: [] }))).toBe(CATALOGUE_LEFT_OUT.NO_PHOTO);
  });

  it("leaves out a product whose only pictures are AI-made (spec A5, R8)", () => {
    expect(reason(product({ photos: [ai("https://img.example/x.jpg"), ai("https://img.example/y.jpg")] }))).toBe(
      CATALOGUE_LEFT_OUT.AI_ONLY,
    );
  });

  it("counts an AI picture's derivative as AI-made (spec A5)", () => {
    const enlarged = { url: "https://img.example/e.jpg", asset: { transform: { tool: "ENLARGE", aiMade: true } } };
    expect(reason(product({ photos: [enlarged] }))).toBe(CATALOGUE_LEFT_OUT.AI_ONLY);
  });

  it("leaves out a product with a blank description (spec R1)", () => {
    expect(reason(product({ description: "   " }))).toBe(CATALOGUE_LEFT_OUT.NO_DESCRIPTION);
  });

  it("names not-live before any listing fault, so a hidden product is never counted as fixable (ux copy deck)", () => {
    expect(reason(product({ live: false, photos: [], description: "" }))).toBe(CATALOGUE_LEFT_OUT.NOT_LIVE);
  });
});

describe("the hash (D2)", () => {
  it("is the same for the same item, whatever order its fields were built in", () => {
    const item = itemOf(product());
    const reordered = Object.fromEntries(Object.entries(item).reverse()) as typeof item;
    expect(catalogueItemHash(reordered)).toBe(catalogueItemHash(item));
    expect(catalogueItemHash(item)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes when the price does, so a price change is sent (spec A2)", () => {
    const before = itemOf(product());
    const after = itemOf(product({ price: { pricePaise: 249950, offerPricePaise: 199950, offerLabel: "Sale" } }));
    expect(catalogueItemHash(after)).not.toBe(catalogueItemHash(before));
  });

  it("changes when stock runs out or a photo moves (spec A2)", () => {
    const base = catalogueItemHash(itemOf(product()));
    expect(catalogueItemHash(itemOf(product({ inStock: false })))).not.toBe(base);
    expect(catalogueItemHash(itemOf(product({ photos: [real("https://img.example/b.jpg")] })))).not.toBe(base);
  });

  it("changes when the additional images reorder", () => {
    const a = real("https://img.example/a.jpg");
    const b = real("https://img.example/b.jpg");
    const c = real("https://img.example/c.jpg");
    expect(catalogueItemHash(itemOf(product({ photos: [a, b, c] })))).not.toBe(
      catalogueItemHash(itemOf(product({ photos: [a, c, b] }))),
    );
  });
});
