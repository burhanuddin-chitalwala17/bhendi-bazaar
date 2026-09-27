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
import { renderableMedia } from "@server/catalog/image-paths";
import { DEFAULT_SHOT_LIST } from "@server/catalog/shot-list";
import { productFormSchema } from "@/lib/validation/schemas/product.schema";
import { assignSlotTo, clearSlot, moveExtra, orderGallery } from "@/components/product/gallery-order";

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
  it("the slot travels with its photograph, and a video's is always null", () => {
    const { rows } = mediaWrite([
      { ...image(A, true), slot: "front" },
      { ...image(B), slot: " " },
      { ...video(), slot: "label" } as ProductMediaInput,
    ]);
    expect(rows.map((row) => row.slot)).toEqual(["front", null, null]);
  });

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

  it("a slot sits only on a photograph — a video is always an extra (media-library D4)", () => {
    const result = productFormSchema.shape.media.safeParse([
      image(A, true),
      { ...video(), slot: "front" },
    ]);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("a video is always an extra");
  });

  it("a slot holds one photograph", () => {
    const result = productFormSchema.shape.media.safeParse([
      { ...image(A, true), slot: "front" },
      { ...image(B), slot: "front" },
    ]);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("one photograph");
  });

  it("a blank slot is no slot, and two extras do not collide", () => {
    const result = productFormSchema.shape.media.safeParse([
      { ...image(A, true), slot: "" },
      { ...image(B), slot: undefined },
    ]);
    expect(result.success).toBe(true);
    expect(result.data?.map((item) => item.slot)).toEqual([null, null]);
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

// A row can still hold a URL on the retired Blob store, and next/image throws on it
// rather than degrading (OPERATIONS.md "Images left behind on the retired store").
describe("renderableMedia", () => {
  const DEAD = "https://o42adyjkazl35sk2.public.blob.vercel-storage.com/products/a.png";

  it("drops a photograph left on the retired store and keeps the rest in order", () => {
    const gallery = [image(A), image(DEAD, true), image(B)];
    expect(renderableMedia(gallery).map((item) => item.ref)).toEqual([A, B]);
  });

  it("never checks a video ref, which is a provider id rather than a URL", () => {
    const video = { kind: "YOUTUBE" as const, ref: VIDEO, isThumbnail: false };
    expect(renderableMedia([video])).toEqual([video]);
  });
});

// The editor keeps the array in the order it shows — filled slots in shot-list order, then the
// extras as arranged — because `position` is written from the index and the buyer's gallery
// follows it (media-library D4). Pure helpers, so the rule is pinned without a DOM.
describe("the gallery is ordered by slot", () => {
  const C = "https://cdn.example.com/c.jpg";
  const D = "https://cdn.example.com/d.jpg";
  const slotted = (ref: string, slot: string, isThumbnail = false): ProductMediaInput => ({
    ...image(ref, isThumbnail),
    slot,
  });
  const refs = (media: ProductMediaInput[]) => media.map((item) => item.ref);
  const slotOf = (media: ProductMediaInput[], ref: string) => media.find((item) => item.ref === ref)?.slot ?? null;

  it("puts filled slots first in shot-list order, then the extras in their own order", () => {
    const media = [image(C), slotted(B, "back"), video(), slotted(A, "front", true), image(D)];
    expect(refs(orderGallery(media, DEFAULT_SHOT_LIST))).toEqual([A, B, C, VIDEO, D]);
  });

  it("never changes the set — every item comes out exactly as it went in", () => {
    const media = [image(C), slotted(B, "back"), video(), slotted(A, "front", true)];
    const ordered = orderGallery(media, DEFAULT_SHOT_LIST);
    expect(ordered).toHaveLength(media.length);
    for (const item of media) expect(ordered).toContain(item);
  });

  it("a slot the category does not declare, or a second claimant, sorts as an extra until cleared", () => {
    const media = [slotted(A, "front"), slotted(B, "front"), slotted(C, "sole"), image(D, true)];
    expect(refs(orderGallery(media, DEFAULT_SHOT_LIST))).toEqual([A, B, C, D]);
    expect(orderGallery(media, DEFAULT_SHOT_LIST).map((item) => item.slot ?? null)).toEqual(["front", "front", "sole", null]);
  });

  it("assigning a slot another photograph holds moves it there and makes the other an extra", () => {
    const media = [slotted(A, "front", true), image(B)];
    const next = assignSlotTo(media, B, "front");
    expect(slotOf(next, B)).toBe("front");
    expect(slotOf(next, A)).toBeNull();
    expect(next.find((item) => item.ref === A)?.isThumbnail).toBe(true);
    expect(refs(orderGallery(next, DEFAULT_SHOT_LIST))).toEqual([B, A]);
  });

  it("moving a photograph between slots leaves the one it came from empty", () => {
    const next = assignSlotTo([slotted(A, "front"), slotted(B, "back")], A, "back");
    expect(next.map((item) => item.slot)).toEqual(["back", null]);
  });

  it("move to extra clears the slot and nothing else", () => {
    const next = clearSlot([slotted(A, "front", true), slotted(B, "back")], A);
    expect(next.map((item) => item.slot)).toEqual([null, "back"]);
    expect(next[0].isThumbnail).toBe(true);
    expect(refs(orderGallery(next, DEFAULT_SHOT_LIST))).toEqual([B, A]);
  });

  it("a blank slot key means extra, so the select's empty option and the button agree", () => {
    expect(assignSlotTo([slotted(A, "front")], A, "")).toEqual(clearSlot([slotted(A, "front")], A));
  });

  it("move up and down apply within the extras only, and the slots stay put", () => {
    const media = [slotted(A, "front", true), image(B), video(), image(C)];
    expect(refs(moveExtra(media, C, -1, DEFAULT_SHOT_LIST))).toEqual([A, B, C, VIDEO]);
    expect(refs(moveExtra(media, B, 1, DEFAULT_SHOT_LIST))).toEqual([A, VIDEO, B, C]);
    // At either end there is nowhere to go; a slotted photo is not in the running.
    expect(refs(moveExtra(media, B, -1, DEFAULT_SHOT_LIST))).toEqual([A, B, VIDEO, C]);
    expect(refs(moveExtra(media, A, 1, DEFAULT_SHOT_LIST))).toEqual([A, B, VIDEO, C]);
  });
});
