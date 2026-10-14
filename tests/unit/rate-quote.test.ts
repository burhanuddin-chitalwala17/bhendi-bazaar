/**
 * A signed shipping quote is the only way a shipping charge reaches an order (Invariant 1).
 * Each case is a way a buyer could edit the request to pay less, or reuse a cheaper quote.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { ConflictError } from "@server/shared/domain-error";
import { signRateQuote, verifyRateQuote, type QuotedRate } from "@server/shipping/rate-quote.service";

const RATE: QuotedRate = {
  providerId: "prov-1",
  providerName: "Shiprocket",
  courierName: "Delhivery Surface",
  courierCode: "12",
  rate: 8900,
  estimatedDays: 4,
  mode: "surface",
};
const SCOPE = { fromPincode: "400003", toPincode: "560001", billableWeightKg: 2 };
const NOW = 1_800_000_000_000;

/** Re-encode a quote's body with one field changed, keeping the original signature. */
function tamper(quote: string, change: Record<string, unknown>): string {
  const [body, signature] = quote.split(".");
  const payload = { ...JSON.parse(Buffer.from(body, "base64url").toString()), ...change };
  return `${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${signature}`;
}

describe("shipping rate quotes", () => {
  beforeAll(() => {
    process.env.NEXTAUTH_SECRET ??= "test-secret";
  });

  it("returns the quoted rate for the parcel it was quoted for", () => {
    const quote = signRateQuote(RATE, SCOPE, NOW);
    expect(verifyRateQuote(quote, SCOPE, NOW + 60_000)).toEqual(RATE);
  });

  it("refuses a quote whose price was edited", () => {
    const quote = tamper(signRateQuote(RATE, SCOPE, NOW), { rate: 0 });
    expect(() => verifyRateQuote(quote, SCOPE, NOW)).toThrow(ConflictError);
  });

  it("refuses a quote for another origin, destination or weight", () => {
    const quote = signRateQuote(RATE, SCOPE, NOW);
    expect(() => verifyRateQuote(quote, { ...SCOPE, toPincode: "400001" }, NOW)).toThrow(ConflictError);
    expect(() => verifyRateQuote(quote, { ...SCOPE, fromPincode: "110001" }, NOW)).toThrow(ConflictError);
    expect(() => verifyRateQuote(quote, { ...SCOPE, billableWeightKg: 5 }, NOW)).toThrow(ConflictError);
  });

  it("refuses an expired quote", () => {
    const quote = signRateQuote(RATE, SCOPE, NOW);
    expect(() => verifyRateQuote(quote, SCOPE, NOW + 31 * 60_000)).toThrow(ConflictError);
  });

  it("refuses a quote signed under another secret", () => {
    const quote = signRateQuote(RATE, SCOPE, NOW);
    const original = process.env.NEXTAUTH_SECRET;
    process.env.NEXTAUTH_SECRET = `${original}-rotated`;
    try {
      expect(() => verifyRateQuote(quote, SCOPE, NOW)).toThrow(ConflictError);
    } finally {
      process.env.NEXTAUTH_SECRET = original;
    }
  });

  it("refuses something that is not a quote at all", () => {
    expect(() => verifyRateQuote("nonsense", SCOPE, NOW)).toThrow(ConflictError);
    expect(() => verifyRateQuote("a.b.c", SCOPE, NOW)).toThrow(ConflictError);
  });
});
