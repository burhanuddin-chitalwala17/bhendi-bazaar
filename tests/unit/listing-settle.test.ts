// Settling marketplace listings (product-merge): what decides a suggestion, what a marketplace's
// detail answer becomes, which photo addresses a copy may fetch, and what a settle request must say.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { mostSimilar, nameSimilarity, SIMILAR_NAME_MIN } from "@server/channels/listing-match";
import { copyablePhotos, isMarketplacePhotoUrl, MAX_COPIED_PHOTOS } from "@server/channels/listing-photos";
import { photosFromCatalog, textFromAttributes, AMAZON_IN } from "@server/channels/providers/amazon/amazon.listings";
import { flipkartListingDetail } from "@server/channels/providers/flipkart/flipkart.listings";
import { settleListingSchema } from "@/lib/validation/schemas/settle-listing.schema";
import { cardReadLine } from "@/components/channel/listing-copy";

const fetchMock = vi.fn();
beforeEach(() => vi.stubGlobal("fetch", fetchMock));
afterEach(() => fetchMock.mockReset());

describe("similar names (D3, Q5)", () => {
  it("scores the same name 1 and an unrelated one below the threshold", () => {
    expect(nameSimilarity("Black Nida Abaya", "black nida abaya")).toBe(1);
    expect(nameSimilarity("Black Nida Abaya", "Oud Attar 12ml")).toBeLessThan(SIMILAR_NAME_MIN);
  });

  it("offers the closest three, best first, and nothing under the threshold", () => {
    const products = [
      { name: "Oud Attar 12ml" },
      { name: "Brass Bakhoor Burner" },
      { name: "Bakhoor Burner Electric" },
      { name: "Velvet Prayer Mat" },
    ];
    const picked = mostSimilar("Bakhoor Burner Brass Handmade", products).map((p) => p.name);
    expect(picked[0]).toBe("Brass Bakhoor Burner");
    expect(picked).toContain("Bakhoor Burner Electric");
    expect(picked).not.toContain("Velvet Prayer Mat");
  });
});

describe("Amazon's listing detail (D1, Q26)", () => {
  it("joins the description with its bullet points, and takes the listing's own title", () => {
    const text = textFromAttributes({
      item_name: [{ value: "Black Nida Abaya with Pockets" }],
      product_description: [{ value: "Premium Nida fabric." }],
      bullet_point: [{ value: "Two side pockets" }, { value: "Front zip" }],
    });
    expect(text.title).toBe("Black Nida Abaya with Pockets");
    expect(text.description).toBe("Premium Nida fabric.\n\n• Two side pockets\n• Front zip");
    expect(textFromAttributes({})).toEqual({ title: null, description: null });
  });

  it("takes every photo on the page for India: the largest of each, main first", () => {
    const urls = photosFromCatalog({
      images: [
        { marketplaceId: "A1F83G8C2ARO7P", images: [{ variant: "MAIN", link: "https://m.media-amazon.com/uk.jpg", width: 2000, height: 2000 }] },
        {
          marketplaceId: AMAZON_IN,
          images: [
            { variant: "PT01", link: "https://m.media-amazon.com/pt01-small.jpg", width: 75, height: 75 },
            { variant: "PT01", link: "https://m.media-amazon.com/pt01.jpg", width: 1500, height: 1500 },
            { variant: "MAIN", link: "https://m.media-amazon.com/main.jpg", width: 1500, height: 1500 },
            { variant: "SWCH", link: "https://m.media-amazon.com/swatch.jpg", width: 30, height: 30 },
          ],
        },
      ],
    });
    expect(urls).toEqual(["https://m.media-amazon.com/main.jpg", "https://m.media-amazon.com/pt01.jpg"]);
  });
});

describe("Flipkart's listing detail (Q20, Q27)", () => {
  it("gives a title and nothing else", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ available: { "KRT-1": { product_title: "Kurta", listing_status: "ACTIVE" } } })));
    const detail = await flipkartListingDetail(async () => "TOKEN", null, { sku: "KRT-1", externalId: "FSN1" });
    expect(detail).toEqual({ title: "Kurta", description: null, photoUrls: [] });
  });
});

describe("which photo addresses a copy may fetch (D6)", () => {
  it("takes https on Amazon's image hosts only", () => {
    expect(isMarketplacePhotoUrl("https://m.media-amazon.com/images/I/a.jpg")).toBe(true);
    expect(isMarketplacePhotoUrl("https://images-na.ssl-images-amazon.com/a.jpg")).toBe(true);
    expect(isMarketplacePhotoUrl("http://m.media-amazon.com/a.jpg")).toBe(false);
    expect(isMarketplacePhotoUrl("https://m.media-amazon.com.evil.example/a.jpg")).toBe(false);
    expect(isMarketplacePhotoUrl("https://169.254.169.254/latest/meta-data")).toBe(false);
  });

  it("stops at nine", () => {
    const many = Array.from({ length: 12 }, (_, i) => `https://m.media-amazon.com/${i}.jpg`);
    expect(copyablePhotos(many)).toHaveLength(MAX_COPIED_PHOTOS);
  });
});

describe("a settle request (D10)", () => {
  const base = { listingIds: ["l1"], stock: [{ locationId: "loc", quantity: 3 }] };

  it("needs a name, SKU, price, category and a photo source to add a new product", () => {
    const result = settleListingSchema.safeParse(base);
    expect(result.success).toBe(false);
    const paths = result.success ? [] : result.error.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["name", "sku", "price", "categoryId", "uploadedPhoto"]));
    expect(
      settleListingSchema.safeParse({ ...base, name: "Abaya", sku: "ABY", price: 1849, categoryId: "c", photosFrom: "l1" }).success,
    ).toBe(true);
  });

  it("needs only listings and stock to match, and refuses a listing named twice", () => {
    expect(settleListingSchema.safeParse({ ...base, productId: "p1" }).success).toBe(true);
    expect(settleListingSchema.safeParse({ ...base, productId: "p1", listingIds: ["l1", "l1"] }).success).toBe(false);
    expect(settleListingSchema.safeParse({ ...base, productId: "p1", stock: [{ locationId: "loc", quantity: -1 }] }).success).toBe(false);
  });
});

describe("the card's line (ux.md \"product and card\")", () => {
  const done = { state: "DONE" as const, total: 480, done: 480, startedAt: null, finishedAt: "2026-10-21T00:00:00Z", error: null, stalled: false };

  it("counts what is still to settle, and says when nothing is", () => {
    expect(cardReadLine(done, { total: 480, linked: 402, toSettle: 78 }, "Amazon")?.text).toBe("480 listings · 402 linked · 78 to settle");
    expect(cardReadLine(done, { total: 480, linked: 476, toSettle: 0 }, "Amazon")?.text).toBe("480 listings · all settled");
  });
});

describe("copying a photo into the library refuses what it should not fetch (D6)", () => {
  it("takes only https, only images, only under the size cap, and follows no redirect", async () => {
    const { mediaImportService } = await import("@server/catalog/media-import.service");
    await expect(mediaImportService.fromUrl("org", null, "http://m.media-amazon.com/a.jpg")).rejects.toThrow(/Couldn't copy that photo/);
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce(new Response("<html></html>", { headers: { "content-type": "text/html" } }));
    await expect(mediaImportService.fromUrl("org", null, "https://m.media-amazon.com/a.jpg")).rejects.toThrow(/Couldn't copy that photo/);

    fetchMock.mockResolvedValueOnce(new Response("x", { headers: { "content-type": "image/jpeg", "content-length": String(16 * 1024 * 1024) } }));
    await expect(mediaImportService.fromUrl("org", null, "https://m.media-amazon.com/a.jpg")).rejects.toThrow(/Couldn't copy that photo/);

    fetchMock.mockResolvedValueOnce(new Response("x", { headers: { "content-type": "image/jpeg" } }));
    await mediaImportService.fromUrl("org", null, "https://m.media-amazon.com/a.jpg").catch(() => undefined);
    expect(fetchMock.mock.calls.at(-1)?.[1]).toMatchObject({ redirect: "error" });
  });
});
