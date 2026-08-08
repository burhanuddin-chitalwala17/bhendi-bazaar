// The accent mapper is the one place a stored CategoryAccent key becomes CSS. Its
// completeness is load-bearing: a key without an entry renders an invisible hero
// gradient, which is exactly the defect the semantic key replaced — the form stored
// flat washes while the storefront expected gradient stops, so form-created
// categories shipped with no gradient at all.
import { describe, expect, it } from "vitest";
import { CategoryAccent } from "@prisma/client";
import { CATEGORY_ACCENTS, CATEGORY_ACCENT_KEYS } from "@/lib/category-accent";

describe("CATEGORY_ACCENTS", () => {
  it("covers every CategoryAccent key the database can hold", () => {
    expect(CATEGORY_ACCENT_KEYS.sort()).toEqual(Object.values(CategoryAccent).sort());
  });

  it.each(Object.values(CategoryAccent))("%s renders both surfaces", (key) => {
    const accent = CATEGORY_ACCENTS[key];
    expect(accent.label.length).toBeGreaterThan(0);
    expect(accent.swatch).toMatch(/^bg-/);
    // The storefront applies this inside bg-gradient-to-br, which needs actual stops.
    expect(accent.heroGradient).toMatch(/from-.+via-.+to-/);
  });
});
