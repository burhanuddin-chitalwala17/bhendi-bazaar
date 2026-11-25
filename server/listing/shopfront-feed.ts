import { CHANNEL } from "@server/shared/channels";
import { feedPrice } from "@server/shared/money";
import type { CategoryMapRow } from "./channel-map.repository";
import type { BuiltField } from "./field-map.types";

/**
 * A shopfront channel's product feed, as RSS 2.0 with the `g:` namespace — the format Google
 * documents and Meta reads ([shopfront-feeds](../../docs/specs/shopfront-feeds/) D3).
 *
 * Pure: the caller hands in products already priced and judged buyable by the read the product
 * page uses, so nothing here can arrive at a price or an availability of its own (spec R2, R3).
 */

export type ShopfrontChannel = typeof CHANNEL.GOOGLE | typeof CHANNEL.META;

/** Each channel's words for the same two states — the documented disagreement (spec hazard 4). */
const AVAILABILITY: Record<ShopfrontChannel, { inStock: string; outOfStock: string }> = {
  [CHANNEL.GOOGLE]: { inStock: "in_stock", outOfStock: "out_of_stock" },
  [CHANNEL.META]: { inStock: "in stock", outOfStock: "out of stock" },
};

/** Google's title limit; Meta's is longer, so one cap satisfies both. */
const TITLE_MAX = 150;
const DESCRIPTION_MAX = 5000;
/** Google takes ten additional images and ignores the rest. */
const ADDITIONAL_IMAGES_MAX = 10;

export interface FeedCandidate {
  id: string;
  title: string;
  description: string;
  /** Absolute. */
  link: string;
  /** Absolute, the cover first. Empty means the channel would reject it (D8). */
  images: string[];
  pricePaise: number;
  /** The resolved offer price when one is in force (`hasOffer`), else null (D5). */
  offerPricePaise: number | null;
  inStock: boolean;
  brand: string;
  /** The channel's category id, or null to let the channel infer one (D7). */
  category: string | null;
  /** Colour, gender, age group, size, material… built from the field maps (listing-model/field-maps R5, channel-catalogue Q8). */
  attributes: readonly BuiltField[];
}

export type CategoryRule = Pick<CategoryMapRow, "productType" | "kind" | "theirCategory" | "notSold">;

export type CategoryVerdict = { sold: false } | { sold: true; category: string | null };

/** The kind's own row wins over its type's kind-less row; `notSold` drops the product (D7). */
export function categoryFor(
  rules: readonly CategoryRule[],
  productType: string | null,
  kind: string | null,
): CategoryVerdict {
  if (!productType) return { sold: true, category: null };
  const forType = rules.filter((rule) => rule.productType === productType);
  const rule =
    (kind ? forType.find((r) => r.kind === kind) : undefined) ??
    forType.find((r) => r.kind === null);
  if (!rule) return { sold: true, category: null };
  if (rule.notSold) return { sold: false };
  return { sold: true, category: rule.theirCategory };
}

/** The buy button's answer: a bidding hold makes an item unbuyable though it has stock (D4, ADR-0023). */
export const isBuyable = (product: { stock: number; biddingSlug?: string | null }) =>
  product.stock > 0 && !product.biddingSlug;

/** Integer paise as `2499.50 INR` (Invariant 3); one spelling shared with the WhatsApp catalogue. */
export const formatPrice = feedPrice;

/** Characters XML 1.0 forbids; one pasted from Word or WhatsApp would void the whole file. */
const NOT_XML = /[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu;

/** By code point, so a cut never splits an emoji into a lone surrogate. */
const truncate = (text: string, max: number) => Array.from(text).slice(0, max).join("");

const escapeXml = (text: string) =>
  text
    .replace(NOT_XML, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const tag = (name: string, value: string) => `<${name}>${escapeXml(value)}</${name}>`;

/** Tags the feed writes itself; a map never writes them twice. */
const FIXED_TAGS = new Set(["id", "title", "description", "link", "image_link", "additional_image_link", "availability", "price", "sale_price", "brand", "condition", "identifier_exists", "google_product_category"]);
/** A tag name is the map's field, which must be a plain XML name. */
const TAG_NAME = /^[a-z][a-z0-9_]*$/;

function item(channel: ShopfrontChannel, c: FeedCandidate): string {
  const [image, ...more] = c.images;
  const words = AVAILABILITY[channel];
  const lines = [
    tag("g:id", c.id),
    tag("g:title", truncate(c.title, TITLE_MAX)),
    tag("g:description", truncate(c.description.trim(), DESCRIPTION_MAX)),
    tag("g:link", c.link),
    tag("g:image_link", image),
    ...more.slice(0, ADDITIONAL_IMAGES_MAX).map((url) => tag("g:additional_image_link", url)),
    tag("g:availability", c.inStock ? words.inStock : words.outOfStock),
    tag("g:price", formatPrice(c.pricePaise)),
    ...(c.offerPricePaise !== null ? [tag("g:sale_price", formatPrice(c.offerPricePaise))] : []),
    tag("g:brand", c.brand),
    tag("g:condition", "new"),
    // We hold no GTINs or MPNs; saying so is what keeps the item from being flagged (D9).
    tag("g:identifier_exists", "no"),
    ...(c.category ? [tag("g:google_product_category", c.category)] : []),
    ...c.attributes.filter((a) => TAG_NAME.test(a.path) && !FIXED_TAGS.has(a.path)).map((a) => tag(`g:${a.path}`, a.unit ? `${a.value} ${a.unit}` : a.value)),
  ];
  return `<item>\n${lines.map((line) => `  ${line}`).join("\n")}\n</item>`;
}

/** What a channel would reject is left out rather than sent (D8). */
// Meta requires a category where Google infers one (field-maps proof run, 2026-11-08).
const sendable = (channel: ShopfrontChannel, c: FeedCandidate) =>
  c.images.length > 0 && c.description.trim().length > 0 && (channel !== CHANNEL.META || c.category !== null);

export function buildFeed(
  channel: ShopfrontChannel,
  header: { title: string; link: string },
  candidates: readonly FeedCandidate[],
): string {
  const items = candidates.filter((c) => sendable(channel, c)).map((c) => item(channel, c));
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">`,
    `<channel>`,
    tag("title", header.title),
    tag("link", header.link),
    tag("description", `${header.title} products`),
    ...items,
    `</channel>`,
    `</rss>`,
    "",
  ].join("\n");
}
