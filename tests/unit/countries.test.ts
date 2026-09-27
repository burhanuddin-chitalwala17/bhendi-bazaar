// A country of origin is an ISO code with a name the runtime already knows, not a string the
// org types (docs/specs/seller-profile/ R3, R4): the list is complete, home comes first, and
// the schemas accept a code or a blank and nothing else.
import { describe, expect, it } from "vitest";
import { COUNTRY_CODES, HOME_COUNTRY, countryName, countryOptions, isCountryCode } from "@server/shared/countries";
import { brandSchema, updateBrandSchema } from "@/lib/validation/schemas/brand.schema";
import { listingDefaultsSchema } from "@/lib/validation/schemas/listing-defaults.schema";

describe("the country list", () => {
  it("is the ISO 3166-1 alpha-2 set, every entry two capitals, no repeats", () => {
    expect(COUNTRY_CODES.length).toBe(249);
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
    for (const code of COUNTRY_CODES) expect(code).toMatch(/^[A-Z]{2}$/);
  });

  it("names codes through ICU, and reads a blank as nothing", () => {
    expect(countryName("IN")).toBe("India");
    expect(countryName("GB")).toBe("United Kingdom");
    expect(countryName(null)).toBe("");
    expect(isCountryCode("IN")).toBe(true);
    expect(isCountryCode("India")).toBe(false);
  });

  it("offers the home market first and the rest by name", () => {
    const options = countryOptions();
    expect(options[0]).toEqual({ code: HOME_COUNTRY, name: "India" });
    const names = options.slice(1).map((option) => option.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")));
    expect(options.length).toBe(COUNTRY_CODES.length);
  });
});

describe("origin on the wire", () => {
  it("a brand's origin is a code or nothing — a typed name is refused", () => {
    expect(brandSchema.parse({ name: "Zed", countryOfOrigin: "IN" }).countryOfOrigin).toBe("IN");
    expect(brandSchema.parse({ name: "Zed", countryOfOrigin: "" }).countryOfOrigin).toBeNull();
    expect(brandSchema.safeParse({ name: "Zed", countryOfOrigin: "India" }).success).toBe(false);
    expect(updateBrandSchema.parse({})).toEqual({});
    expect(updateBrandSchema.parse({ countryOfOrigin: "" })).toEqual({ countryOfOrigin: null });
  });

  it("the defaults' origin follows the same rule", () => {
    expect(listingDefaultsSchema.parse({ countryOfOrigin: "AE" }).countryOfOrigin).toBe("AE");
    expect(listingDefaultsSchema.safeParse({ countryOfOrigin: "UAE" }).success).toBe(false);
  });
});
