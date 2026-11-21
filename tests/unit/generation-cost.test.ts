/**
 * What a picture costs (generation-foundation spec R6, R10; trd D3, D7): every price rule in
 * integer micro-dollars, paise rounded up at the day's rate, and the ECB answer parsed to integer
 * paise. Invariant 3: no float survives past the boundary where the rate arrives.
 */
import { describe, expect, it } from "vitest";
import { microUsdToPaise, priceMicroUsd } from "@server/content/generation/pricing";
import { MODELS, modelById } from "@server/content/generation/registry";
import { parseRate } from "@server/content/generation/exchange-rate";
import { pixelsFor } from "@server/content/generation/generation.types";

const price = (id: string, references = 1, aspect: "1:1" | "4:5" = "1:1", size: "1K" | "2K" = "1K") => {
  const model = modelById(id);
  if (!model) throw new Error(id);
  return priceMicroUsd(model.price, references, aspect, size);
};

describe("price rules", () => {
  it("prices klein-4b by tile: four output tiles and four for the one reference", () => {
    expect(price("cf/flux-2-klein-4b")).toBe(4 * 287 + 4 * 59);
  });

  it("prices klein-9b by megapixel: the first, and one per reference", () => {
    expect(price("cf/flux-2-klein-9b", 2)).toBe(15_000 + 2 * 2_000);
    expect(price("cf/flux-2-klein-9b", 0, "1:1", "2K")).toBe(15_000 + 3 * 2_000);
  });

  it("prices flux-2-dev per step, at the steps we send", () => {
    expect(price("cf/flux-2-dev", 0)).toBe(4 * 410 * 28);
  });

  it("prices Nano Banana Pro flat, plus each reference, the same on both routes", () => {
    expect(price("cf/nano-banana-pro", 3)).toBe(134_000 + 3 * 1_100);
    expect(price("gemini/nano-banana-pro", 3)).toBe(price("cf/nano-banana-pro", 3));
  });

  it("gives every model a whole-number price at every size it makes", () => {
    for (const model of MODELS) {
      for (const size of model.sizes) {
        expect(Number.isInteger(priceMicroUsd(model.price, model.maxReferences, "1:1", size))).toBe(true);
      }
      expect(model.checked).toMatch(/^\d{4}-\d{2}-\d{2} /);
    }
  });
});

describe("paise at the day's rate", () => {
  it("rounds up to the whole paisa, never down", () => {
    // $0.001384 at ₹93.40 is 12.93 paise: the platform spent 13, not 12.
    expect(microUsdToPaise(1_384, 9_340)).toBe(13);
    expect(microUsdToPaise(1_000_000, 9_340)).toBe(9_340);
    expect(microUsdToPaise(0, 9_340)).toBe(0);
  });

  it("refuses a non-integer input rather than computing money in floats", () => {
    expect(() => microUsdToPaise(1.5, 9_340)).toThrow(/integers/);
    expect(() => microUsdToPaise(100, 93.4)).toThrow(/integers/);
  });
});

describe("the ECB answer", () => {
  it("becomes integer paise per dollar", () => {
    expect(parseRate({ amount: 1, base: "USD", date: "2026-11-20", rates: { INR: 93.4 } })).toEqual({ paisePerUsd: 9_340, asOf: "2026-11-20" });
  });

  it.each([null, {}, { rates: {} }, { rates: { INR: "93.4" } }, { rates: { INR: 0 } }, { rates: { INR: Number.NaN } }])(
    "is no rate when it is not one: %j",
    (payload) => expect(parseRate(payload)).toBeNull(),
  );
});

describe("shapes", () => {
  it("rounds every size to the 16-pixel grid with the long edge exact", () => {
    expect(pixelsFor("1:1", "1K")).toEqual({ width: 1024, height: 1024 });
    expect(pixelsFor("4:5", "1K")).toEqual({ width: 816, height: 1024 });
    expect(pixelsFor("9:16", "2K")).toEqual({ width: 1152, height: 2048 });
  });
});
