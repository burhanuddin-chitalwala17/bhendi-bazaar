/**
 * A caption states only the product's own prices (ai-images/social-posts D3, D4; R5, R6; Q47): the
 * post-check refuses an invented number, the template passes its own check, a changed price is found
 * while the caption still states it, and Update price swaps that number and nothing else.
 */
import { describe, expect, it } from "vitest";
import {
  checkCaption,
  formatRupees,
  mergeStated,
  priceChangesBetween,
  restated,
  rewritePrices,
  statesPrice,
  templateCaption,
} from "@server/content/caption/rules";
import { CAPTION_LANGUAGE, CAPTION_MAX_CHARS, CAPTION_MAX_HASHTAGS, type CaptionFacts } from "@server/content/caption.types";

const facts = (over: Partial<CaptionFacts> = {}): CaptionFacts => ({
  shopName: "Niqab Boutique",
  language: CAPTION_LANGUAGE.EN,
  products: [
    {
      productId: "p1",
      name: "Nida abaya",
      pricePaise: 129_900,
      offerPricePaise: 103_900,
      offerLabel: "20% off",
      category: "Abayas",
      material: "Nida",
    },
  ],
  ...over,
});

describe("the caption post-check (spec A3, D3)", () => {
  it("passes a caption with the offer price, the list price, the offer and hashtags (spec A3)", () => {
    const text = "Nida abaya, now ₹1,039 (was ₹1,299) — 20% off at Niqab Boutique.\n#abaya #modestfashion";
    expect(checkCaption(text, facts())).toEqual({ ok: true, text });
  });

  it("refuses a price the product does not have (spec A3)", () => {
    const result = checkCaption("Nida abaya, only ₹899! #abaya", facts());
    expect(result.ok).toBe(false);
  });

  it("refuses an invented price written in Devanagari digits", () => {
    expect(checkCaption("निदा अबाया, सिर्फ़ ₹८९९ #abaya", facts()).ok).toBe(false);
    expect(checkCaption("निदा अबाया, अब ₹१,०३९ #abaya", facts()).ok).toBe(true);
  });

  it("refuses the saving written as a price, which the facts never give", () => {
    expect(checkCaption("Nida abaya, now ₹260!", facts()).ok).toBe(false);
  });

  it("refuses a bare number nothing in the facts says", () => {
    expect(checkCaption("Only 3 left! Nida abaya ₹1,039", facts()).ok).toBe(false);
  });

  it("allows a number that is part of the product's own name", () => {
    const named = facts({ products: [{ ...facts().products[0]!, name: "Nida abaya 2-piece" }] });
    expect(checkCaption("Nida abaya 2-piece, ₹1,039", named).ok).toBe(true);
  });

  it("refuses a name's number written as a price", () => {
    const named = facts({ products: [{ ...facts().products[0]!, name: "Nida abaya 2-piece" }] });
    expect(checkCaption("Nida abaya 2-piece, ₹2", named).ok).toBe(false);
  });

  it("refuses an empty draft, one too long and one with too many hashtags", () => {
    expect(checkCaption("   ", facts()).ok).toBe(false);
    expect(checkCaption("a".repeat(CAPTION_MAX_CHARS + 1), facts()).ok).toBe(false);
    const tags = Array.from({ length: CAPTION_MAX_HASHTAGS + 1 }, (_, i) => `#tag${"x".repeat(i)}`).join(" ");
    expect(checkCaption(`Nida abaya ${tags}`, facts()).ok).toBe(false);
  });
});

describe("the template caption (D3)", () => {
  for (const language of Object.values(CAPTION_LANGUAGE)) {
    it(`passes its own check in ${language}, with the live price`, () => {
      const f = facts({ language });
      const text = templateCaption(f);
      expect(checkCaption(text, f).ok).toBe(true);
      expect(text).toContain("₹1,039");
      expect(text).toMatch(/#/);
    });
  }

  it("stays inside the limits however many products the post names", () => {
    const many = facts({
      language: CAPTION_LANGUAGE.BOTH,
      products: Array.from({ length: 10 }, (_, i) => ({
        ...facts().products[0]!,
        productId: `p${i}`,
        name: `A rather long product name for a caption template number ${"x".repeat(i)}`,
      })),
    });
    const text = templateCaption(many);
    expect(text.length).toBeLessThanOrEqual(CAPTION_MAX_CHARS);
    expect(checkCaption(text, many).ok).toBe(true);
  });
});

describe("staleness and Update price (spec A4, D4)", () => {
  const recorded = { productIds: ["p1"], pricesPaise: [129_900], effectivePricesPaise: [103_900] };

  it("finds the product whose price changed since the draft (spec A4)", () => {
    const live = new Map([["p1", { pricePaise: 129_900, effectivePricePaise: 99_900 }]]);
    expect(priceChangesBetween(recorded, live)).toEqual([{ productId: "p1", wasPaise: 103_900, nowPaise: 99_900, rewritable: true }]);
  });

  it("finds nothing when the prices are as drafted, or the product is gone", () => {
    expect(priceChangesBetween(recorded, new Map([["p1", { pricePaise: 129_900, effectivePricePaise: 103_900 }]]))).toEqual([]);
    expect(priceChangesBetween(recorded, new Map())).toEqual([]);
  });

  it("says whether a caption still states a price, however it is grouped (spec A4)", () => {
    expect(statesPrice("Now ₹1,039!", 103_900)).toBe(true);
    expect(statesPrice("Now Rs 1039!", 103_900)).toBe(true);
    expect(statesPrice("Now ₹999!", 103_900)).toBe(false);
  });

  it("swaps the old price for the new one and changes nothing else (spec A4)", () => {
    const caption = "Nida abaya ₹1,039 (was ₹1,299), 20% off. #abaya";
    expect(rewritePrices(caption, [{ productId: "p1", wasPaise: 103_900, nowPaise: 99_900, rewritable: true }])).toBe(
      "Nida abaya ₹999 (was ₹1,299), 20% off. #abaya",
    );
  });

  it("keeps an earlier draft's prices, so a kept or added-below older caption is still caught (spec A4)", () => {
    const later = { productIds: ["p1"], pricesPaise: [129_900], effectivePricesPaise: [99_900] };
    const merged = mergeStated(recorded, later);
    const live = new Map([["p1", { pricePaise: 129_900, effectivePricePaise: 99_900 }]]);
    expect(priceChangesBetween(merged, live)).toEqual([{ productId: "p1", wasPaise: 103_900, nowPaise: 99_900, rewritable: true }]);
    expect(mergeStated(merged, later)).toEqual(merged);
  });

  it("restates only the prices Update price wrote, not a later read", () => {
    const change = { productId: "p1", wasPaise: 103_900, nowPaise: 99_900, rewritable: true };
    expect(restated(recorded, [change])).toEqual({ productIds: ["p1"], pricesPaise: [129_900], effectivePricesPaise: [99_900] });
  });

  it("will not swap a price when the offer itself ended", () => {
    const live = new Map([["p1", { pricePaise: 129_900, effectivePricePaise: 129_900 }]]);
    expect(priceChangesBetween(recorded, live)).toEqual([{ productId: "p1", wasPaise: 103_900, nowPaise: 129_900, rewritable: false }]);
  });

  it("will not swap an amount another product has today", () => {
    const two = { productIds: ["p1", "p2"], pricesPaise: [100_000, 100_000], effectivePricesPaise: [100_000, 100_000] };
    const live = new Map([
      ["p1", { pricePaise: 100_000, effectivePricePaise: 100_000 }],
      ["p2", { pricePaise: 120_000, effectivePricePaise: 120_000 }],
    ]);
    expect(priceChangesBetween(two, live)).toEqual([{ productId: "p2", wasPaise: 100_000, nowPaise: 120_000, rewritable: false }]);
  });

  it("formats rupees with Indian grouping and paise only when there are some", () => {
    expect(formatRupees(12_999_900)).toBe("₹1,29,999");
    expect(formatRupees(129_950)).toBe("₹1,299.50");
  });
});
