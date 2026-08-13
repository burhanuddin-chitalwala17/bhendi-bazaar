// The product gallery became rows that can hold video, and the cover became a flag the
// seller sets rather than "whatever is first" (docs/specs/product-video/).
//
// This file replaces thumbnail-sync.test.ts, which pinned the opposite rule: that
// `thumbnail` always followed images[0]. That rule stopped an edited gallery leaving a
// stale card image, but it also meant the seller could not choose — so the behaviour is
// deliberately inverted here, and the first test below is the one that says so.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  MAX_MEDIA_PER_PRODUCT,
  coverOf,
  parseYoutubeRef,
  youtubeEmbedUrl,
  youtubePosterUrl,
  type ProductMediaInput,
} from "@server/catalog/media";
import { mediaWrite } from "@server/catalog/admin.product.repository";
import { productFormSchema } from "@/lib/validation/schemas/product.schema";

const A = "https://cdn.example.com/a.jpg";
const B = "https://cdn.example.com/b.jpg";
const VIDEO = "aqz-KE-bpKQ";

const image = (ref: string, isThumbnail = false): ProductMediaInput => ({
  kind: "IMAGE",
  ref,
  isThumbnail,
});
const video = (ref = VIDEO): ProductMediaInput => ({ kind: "YOUTUBE", ref, isThumbnail: false });

describe("the cover is the flag, not the position", () => {
  // The inversion. Under the old rule this expectation would have been `B`.
  it("reordering the gallery does not move the cover", () => {
    const before = mediaWrite([image(A, true), image(B)]);
    const after = mediaWrite([image(B), image(A, true)]);
    expect(before.thumbnail).toBe(A);
    expect(after.thumbnail).toBe(A);
  });

  it("a video promoted to first does not become the cover", () => {
    expect(mediaWrite([video(), image(A, true)]).thumbnail).toBe(A);
  });

  it("positions come from array order, and the flag travels with its item", () => {
    const { rows } = mediaWrite([video(), image(A, true), image(B)]);
    expect(rows.map((row) => row.position)).toEqual([0, 1, 2]);
    expect(rows.map((row) => row.isThumbnail)).toEqual([false, true, false]);
  });

  it("blank descriptions are stored as null, not empty strings", () => {
    const { rows } = mediaWrite([{ ...image(A, true), description: "   " }]);
    expect(rows[0].description).toBeNull();
  });

  // A fallback here is how an unset cover becomes survivable instead of loud (D4a).
  it("refuses to invent a cover when nothing is flagged", () => {
    expect(() => coverOf([image(A), image(B)])).toThrow(/no cover/i);
  });
});

describe("gallery rules at the boundary", () => {
  const base = {
    name: "Cream Rida",
    description: "A lightweight cream rida.",
    price: 1200,
    currency: "INR",
    categoryId: "cat_1",
    orgId: "org_1",
    weight: 0.5,
    stockLocations: [{ orgAddressId: "loc_1", quantity: 5 }],
    lowStockThreshold: 10,
  };
  const parse = (media: ProductMediaInput[]) => productFormSchema.safeParse({ ...base, media });
  const errorsOf = (media: ProductMediaInput[]) =>
    parse(media).error?.issues.map((issue) => issue.message).join(" | ") ?? "";

  it("accepts photographs with no video", () => {
    expect(parse([image(A, true), image(B)]).success).toBe(true);
  });

  it("accepts a video sitting first, as long as a photograph is the cover", () => {
    expect(parse([video(), image(A, true)]).success).toBe(true);
  });

  it("rejects a gallery that is only video (R11)", () => {
    expect(errorsOf([{ ...video(), isThumbnail: false }])).toMatch(/at least one photograph/i);
  });

  it("rejects no cover at all (R15/D17 — nothing pre-selects one)", () => {
    expect(errorsOf([image(A), image(B)])).toMatch(/exactly one photograph as the cover/i);
  });

  it("rejects two covers", () => {
    expect(errorsOf([image(A, true), image(B, true)])).toMatch(/exactly one/i);
  });

  it("rejects a video as the cover (R12)", () => {
    expect(errorsOf([{ ...video(), isThumbnail: true }, image(A)])).toMatch(/cover must be a photograph|exactly one/i);
  });

  it("rejects an empty gallery", () => {
    expect(errorsOf([])).toMatch(/at least one photograph/i);
  });

  it(`rejects more than ${MAX_MEDIA_PER_PRODUCT} items (R14)`, () => {
    const many = Array.from({ length: MAX_MEDIA_PER_PRODUCT + 1 }, (_, i) =>
      image(`${A}?${i}`, i === 0)
    );
    expect(errorsOf(many)).toMatch(/at most/i);
  });

  it("does not accept a thumbnail from the payload — it is server-owned", () => {
    const parsed = productFormSchema.safeParse({
      ...base,
      media: [image(A, true)],
      thumbnail: "https://evil.example.com/spoof.jpg",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data).not.toHaveProperty("thumbnail");
  });
});

describe("parseYoutubeRef", () => {
  it.each([
    ["https://www.youtube.com/watch?v=aqz-KE-bpKQ", VIDEO],
    ["https://youtube.com/watch?v=aqz-KE-bpKQ&t=42s", VIDEO],
    ["https://youtu.be/aqz-KE-bpKQ", VIDEO],
    ["https://www.youtube.com/shorts/aqz-KE-bpKQ", VIDEO],
    ["https://www.youtube.com/embed/aqz-KE-bpKQ", VIDEO],
    ["https://m.youtube.com/watch?v=aqz-KE-bpKQ", VIDEO],
    ["  aqz-KE-bpKQ  ", VIDEO],
  ])("reads %s", (input, expected) => {
    expect(parseYoutubeRef(input)).toBe(expected);
  });

  it.each([
    "",
    "not a url",
    "https://vimeo.com/12345",
    "https://www.youtube.com/watch?v=tooshort",
    "https://example.com/watch?v=aqz-KE-bpKQ",
  ])("rejects %s", (input) => {
    expect(parseYoutubeRef(input)).toBeNull();
  });

  // ADR-0017 decision 2: what is stored identifies a video, not a host.
  it("yields a bare id, never a provider URL", () => {
    expect(parseYoutubeRef("https://youtu.be/aqz-KE-bpKQ")).not.toMatch(/https?:/);
  });
});

describe("YouTube URLs", () => {
  // maxresdefault 404s for any video never published above 720p, and a broken poster is
  // worse than a soft one (D15).
  it("uses hqdefault for the poster", () => {
    expect(youtubePosterUrl(VIDEO)).toBe(`https://i.ytimg.com/vi/${VIDEO}/hqdefault.jpg`);
  });

  it("embeds from the nocookie host", () => {
    expect(youtubeEmbedUrl(VIDEO)).toContain("youtube-nocookie.com");
  });
});

describe("the product-media migration", () => {
  const sql = readFileSync("prisma/migrations/20260813000000_product_media/migration.sql", "utf8");

  // Neither is expressible in Prisma's schema language, so their only home is this file.
  it("makes one cover per product a database fact", () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX[\s\S]*?ON "ProductMedia"\("productId"\) WHERE "isThumbnail"/);
  });

  it("makes a cover provably a photograph", () => {
    expect(sql).toMatch(/CHECK \(NOT "isThumbnail" OR "kind" = 'IMAGE'\)/);
  });

  it("prefers the row matching the existing thumbnail, so no card changes appearance", () => {
    expect(sql).toMatch(/ORDER BY m\."productId", \(m\."ref" = p\."thumbnail"\) DESC, m\."position" ASC/);
  });

  it("aborts rather than committing a product without exactly one cover", () => {
    expect(sql).toMatch(/RAISE EXCEPTION 'every product must have exactly one cover/);
  });

  it("freezes the order-line picture", () => {
    expect(sql).toMatch(/ALTER TABLE "OrderItem" ADD COLUMN "thumbnail" TEXT/);
  });

  it("drops the old column in a separate migration, so the cutover stays reversible", () => {
    const dropSql = readFileSync(
      "prisma/migrations/20260813010000_drop_product_images/migration.sql",
      "utf8"
    );
    expect(sql).not.toMatch(/DROP COLUMN[\s\S]*"images"/);
    expect(dropSql).toMatch(/DROP COLUMN IF EXISTS "images"/);
  });
});
