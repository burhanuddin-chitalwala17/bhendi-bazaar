/**
 * The feed serialiser ([shopfront-feeds](../../docs/specs/shopfront-feeds/) D3–D12). Pure, so what
 * is checked here is what a channel would reject or misread: a price written wrong, a name that
 * breaks the XML, availability in the other channel's words, a category from the wrong row.
 */
import { describe, expect, it } from "vitest";

import { CHANNEL } from "@server/shared/channels";
import {
  buildFeed,
  categoryFor,
  formatPrice,
  isBuyable,
  type FeedCandidate,
} from "@server/listing/shopfront-feed";

const HEADER = { title: "Bhendi Bazaar", link: "https://shop.example" };

const candidate = (over: Partial<FeedCandidate> = {}): FeedCandidate => ({
  id: "p1",
  title: "Black Abaya",
  description: "Nida, full length.",
  link: "https://shop.example/product/black-abaya",
  images: ["https://img.example/a.jpg"],
  pricePaise: 249900,
  offerPricePaise: null,
  inStock: true,
  brand: "Al Noor",
  category: "1604",
  attributes: [],
  ...over,
});

const items = (xml: string) => xml.split("<item>").slice(1);

describe("formatPrice (D5)", () => {
  it("writes integer paise as rupees with two places, never through a float", () => {
    expect(formatPrice(0)).toBe("0.00 INR");
    expect(formatPrice(5)).toBe("0.05 INR");
    expect(formatPrice(99)).toBe("0.99 INR");
    expect(formatPrice(249950)).toBe("2499.50 INR");
  });
});

describe("buildFeed", () => {
  it("escapes markup in names and descriptions, so one product cannot break the file (D12)", () => {
    const xml = buildFeed(CHANNEL.GOOGLE, HEADER, [
      candidate({ title: "Attar & Oud <50ml>", description: `"Rose" & musk` }),
    ]);
    expect(xml).toContain("<g:title>Attar &amp; Oud &lt;50ml&gt;</g:title>");
    expect(xml).toContain("&quot;Rose&quot; &amp; musk");
    expect(xml).not.toContain("Oud <50ml>");
  });

  it("declares the offer price beside the list price, and no sale price without an offer (spec A2)", () => {
    const [onOffer, full] = items(
      buildFeed(CHANNEL.GOOGLE, HEADER, [
        candidate({ id: "a", offerPricePaise: 199900 }),
        candidate({ id: "b" }),
      ]),
    );
    expect(onOffer).toContain("<g:price>2499.00 INR</g:price>");
    expect(onOffer).toContain("<g:sale_price>1999.00 INR</g:sale_price>");
    expect(full).not.toContain("g:sale_price");
  });

  it("drops characters XML forbids, so one pasted description cannot void the whole file (D12)", () => {
    const xml = buildFeed(CHANNEL.GOOGLE, HEADER, [candidate({ description: "Soft\x0Bnida\x1F." })]);
    expect(xml).toContain("<g:description>Softnida.</g:description>");
  });

  it("writes availability in each channel's own words (spec A3, D4)", () => {
    const out = candidate({ id: "out", inStock: false });
    const google = buildFeed(CHANNEL.GOOGLE, HEADER, [candidate(), out]);
    const meta = buildFeed(CHANNEL.META, HEADER, [candidate(), out]);
    expect(items(google)[0]).toContain("<g:availability>in_stock</g:availability>");
    expect(items(google)[1]).toContain("<g:availability>out_of_stock</g:availability>");
    expect(items(meta)[0]).toContain("<g:availability>in stock</g:availability>");
    expect(items(meta)[1]).toContain("<g:availability>out of stock</g:availability>");
  });

  it("leaves out a product with no image or no description rather than sending a rejection (D8)", () => {
    const xml = buildFeed(CHANNEL.GOOGLE, HEADER, [
      candidate({ id: "keep" }),
      candidate({ id: "no-image", images: [] }),
      candidate({ id: "no-words", description: "   " }),
    ]);
    expect(items(xml)).toHaveLength(1);
    expect(xml).toContain("<g:id>keep</g:id>");
  });

  it("leaves an item with no category out of Meta's feed, which requires one, and keeps it in Google's, which infers one", () => {
    const uncategorised = [candidate({ id: "no-category", category: null })];
    expect(items(buildFeed(CHANNEL.META, HEADER, uncategorised))).toHaveLength(0);
    expect(items(buildFeed(CHANNEL.GOOGLE, HEADER, uncategorised))).toHaveLength(1);
  });

  it("caps a title at 150 characters without splitting an emoji", () => {
    const [item] = items(buildFeed(CHANNEL.GOOGLE, HEADER, [candidate({ title: "x".repeat(200) })]));
    expect(item).toContain(`<g:title>${"x".repeat(150)}</g:title>`);
    const [emoji] = items(
      buildFeed(CHANNEL.GOOGLE, HEADER, [candidate({ title: `${"x".repeat(149)}🌙🌙` })]),
    );
    expect(emoji).toContain(`<g:title>${"x".repeat(149)}🌙</g:title>`);
  });

  it("sends the first image as the main one and the rest as additional (D10)", () => {
    const [item] = items(
      buildFeed(CHANNEL.GOOGLE, HEADER, [
        candidate({ images: ["https://img.example/1.jpg", "https://img.example/2.jpg"] }),
      ]),
    );
    expect(item).toContain("<g:image_link>https://img.example/1.jpg</g:image_link>");
    expect(item).toContain("<g:additional_image_link>https://img.example/2.jpg</g:additional_image_link>");
  });

  it("omits the category when nothing is mapped, so the channel infers it (D7)", () => {
    const [item] = items(buildFeed(CHANNEL.GOOGLE, HEADER, [candidate({ category: null })]));
    expect(item).not.toContain("google_product_category");
  });

  it("is a valid empty channel when there is nothing to list (D11)", () => {
    const xml = buildFeed(CHANNEL.META, HEADER, []);
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/);
    expect(xml).toContain("<channel>");
    expect(items(xml)).toHaveLength(0);
  });
});

describe("isBuyable (D4)", () => {
  it("is false for an item held by a live bidding event though it has stock (spec R3, A3)", () => {
    expect(isBuyable({ stock: 3, biddingSlug: "eid-sale" })).toBe(false);
    expect(isBuyable({ stock: 3 })).toBe(true);
    expect(isBuyable({ stock: 0 })).toBe(false);
  });
});

describe("categoryFor (D7)", () => {
  const rules = [
    { productType: "islamic-wear", kind: null, theirCategory: "1604", notSold: false },
    { productType: "islamic-wear", kind: "hijab", theirCategory: "543673", notSold: false },
    { productType: "combo", kind: null, theirCategory: null, notSold: true },
  ];

  it("lets the kind's own row beat its type's kind-less row", () => {
    expect(categoryFor(rules, "islamic-wear", "hijab")).toEqual({ sold: true, category: "543673" });
    expect(categoryFor(rules, "islamic-wear", "abaya")).toEqual({ sold: true, category: "1604" });
  });

  it("drops a type mapped as not sold on the channel", () => {
    expect(categoryFor(rules, "combo", null)).toEqual({ sold: false });
  });

  it("sends an unmapped or untyped product without a category", () => {
    expect(categoryFor(rules, "socks", null)).toEqual({ sold: true, category: null });
    expect(categoryFor(rules, null, null)).toEqual({ sold: true, category: null });
  });
});
