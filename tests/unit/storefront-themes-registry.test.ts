/**
 * The theme registry and the CSS that renders it agree (storefront-themes A1, R1–R3; D1, D2, D5).
 *
 * A key in code with no scope renders the platform look under a theme's name; a scope with no
 * key is a palette no shop can reach. A composition naming a section or variant the library
 * does not draw renders a hole in a shop's page (U2; D1, D8, Q8).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  CARD_STYLE,
  COMPOSITIONS,
  FACE_VARIABLE,
  HIDEABLE_SECTIONS,
  SECTION,
  SECTION_KEYS,
  SECTION_VARIANTS,
  PALETTE,
  THEME,
  THEMES,
  THEME_KEYS,
  readStorefrontLook,
  FONT_KEYS,
  FONTS as FONTS_LIST,
  SUGGESTED_FONTS,
  defaultFont,
  readFontKey,
} from "@server/catalog/storefront-themes";

const CSS = readFileSync("src/app/globals.css", "utf8");
const FONTS = readFileSync("src/components/storefront/theme-fonts.ts", "utf8");

const scopeKeys = (attr: string) =>
  [...CSS.matchAll(new RegExp(`^\\[data-${attr}="([a-z]+)"\\] \\{`, "gm"))].map((m) => m[1]);

function themeScope(theme: string): Map<string, string> {
  const body = CSS.split(`[data-theme="${theme}"] {`)[1]?.split("}")[0] ?? "";
  return new Map([...body.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)].map(([, k, v]) => [k, v.trim()]));
}

describe("palettes (R3)", () => {
  it.each(THEME_KEYS)("%s carries exactly three palettes, none shared", (theme) => {
    expect(THEMES[theme].palettes).toHaveLength(3);
  });

  it("every palette belongs to exactly one theme", () => {
    const owned = THEME_KEYS.flatMap((t) => THEMES[t].palettes.map((p) => p.key));
    expect(owned.sort()).toEqual(Object.values(PALETTE).sort());
  });

  it("a scope per palette, and a palette per scope", () => {
    expect(scopeKeys("palette").sort()).toEqual(Object.values(PALETTE).sort());
  });
});

describe("themes (R1, D2)", () => {
  it("a scope per theme, and a theme per scope", () => {
    expect(scopeKeys("theme").sort()).toEqual([...THEME_KEYS].sort());
  });

  it.each(THEME_KEYS)("%s uses at most two face families (Q7, Q30)", (theme) => {
    expect(new Set(Object.values(THEMES[theme].faces)).size).toBeLessThanOrEqual(2);
  });

  it.each(THEME_KEYS)("%s's scope points each face role at the registry's family", (theme) => {
    const scope = themeScope(theme);
    const faces = THEMES[theme].faces;
    for (const role of ["display", "body", "label"] as const) {
      const declared = scope.get(`--font-${role}-face`) ?? "var(--font-body-face)";
      expect(declared, `${theme} ${role}`).toBe(`var(${FACE_VARIABLE[faces[role]]})`);
    }
  });

  it("themes differ in at least three non-colour roles, pairwise (A1)", () => {
    const ROLES = [
      "--tracking-headline", "--font-display-weight", "--display-case",
      "--radius-card", "--radius-field", "--shadow-tile-value", "--font-display-face",
    ];
    for (const a of THEME_KEYS) {
      for (const b of THEME_KEYS) {
        if (a >= b) continue;
        const [sa, sb] = [themeScope(a), themeScope(b)];
        const differing = ROLES.filter((r) => sa.get(r) !== sb.get(r));
        expect(differing.length, `${a} vs ${b}: ${differing.join(", ")}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  // storefront-look Q1: templates differ in style, never in proportion.
  const PROPORTION = /^--(?:text-|spacing-|container-)/;
  it.each(THEME_KEYS)("%s sets no size, spacing or width of its own (storefront-look A6)", (theme) => {
    const set = [...themeScope(theme).keys()].filter((k) => PROPORTION.test(k));
    expect(set, `${theme} overrides the platform scale`).toEqual([]);
  });

  it.each(THEME_KEYS)("%s declares its display weight and case (storefront-look Q1, Q7)", (theme) => {
    const scope = themeScope(theme);
    expect(scope.get("--font-display-weight")).toMatch(/^[1-9]00$/);
    expect(scope.get("--display-case")).toMatch(/^(?:none|uppercase)$/);
  });

  it("every type size keeps a rem floor and a rem term, never viewport-only (D2)", () => {
    const sizes = [...CSS.matchAll(/--text-(?:headline|title):\s*([^;]+);/g)].map((m) => m[1]);
    expect(sizes.length).toBeGreaterThanOrEqual(2);
    for (const size of sizes) {
      expect(size).toMatch(/^clamp\([\d.]+rem, [\d.]+rem \+ [\d.]+vw, [\d.]+rem\)$/);
    }
  });

  it("reduced motion zeroes every theme's motion (D14)", () => {
    const block = CSS.split("@media (prefers-reduced-motion: reduce)")[1]?.split("}\n}")[0] ?? "";
    expect(block).toMatch(/\[data-theme\]\s*\{\s*--motion-duration:\s*0ms;/);
  });
});

describe("fonts (D5)", () => {
  const loaders = [...FONTS.matchAll(/= (\w+)\(\{([\s\S]*?)\}\);/g)];

  it("loads every family the registry names, and only those", () => {
    const themeVars = THEME_KEYS.flatMap((t) => Object.values(THEMES[t].faces)).map((f) => FACE_VARIABLE[f]);
    const fontVars = FONT_KEYS.map((k) => FONTS_LIST[k].variable);
    const loadedVars = loaders.map(([, , body]) => body.match(/variable: "([\w-]+)"/)?.[1]);
    // The root layout's DM Sans and Playfair Display are already on every page.
    const ROOT = new Set(["--font-body-face", "--font-heading-face"]);
    const expected = [...new Set([...themeVars, ...fontVars])].filter((v) => !ROOT.has(v));
    expect(loadedVars.sort()).toEqual(expected.sort());
  });

  it.each(loaders.map(([, name, body]) => [name, body]))(
    "%s is not preloaded, so a page fetches only its theme's faces",
    (_, body) => {
      expect(body).toContain("preload: false");
      expect(body).toContain('display: "swap"');
    },
  );
});

describe("stored keys are parsed on read (D1)", () => {
  it("an unknown theme reads as unthemed", () => {
    expect(readStorefrontLook("retro", PALETTE.CARBON)).toBeNull();
    expect(readStorefrontLook(null, null)).toBeNull();
  });

  it("a palette from another theme reads as the theme's first", () => {
    expect(readStorefrontLook(THEME.DARBAR, PALETTE.CARBON)).toEqual({
      theme: THEME.DARBAR,
      palette: PALETTE.EMERALD,
    });
  });

  it("a valid pair reads as itself", () => {
    expect(readStorefrontLook(THEME.DAILY, PALETTE.COBALT)).toEqual({
      theme: THEME.DAILY,
      palette: PALETTE.COBALT,
    });
  });
});

describe("compositions (U2; R2, A1, Q8)", () => {
  const variantsOf = (section: string) =>
    (SECTION_VARIANTS as Record<string, readonly string[]>)[section] ?? [];

  it.each(THEME_KEYS)("%s names only declared sections, each in one of its variants", (theme) => {
    for (const { section, variant } of COMPOSITIONS[theme].sections) {
      expect(SECTION_KEYS, `${theme}: ${section}`).toContain(section);
      expect(variantsOf(section), `${theme}: ${section}.${variant}`).toContain(variant);
    }
  });

  it.each(THEME_KEYS)("%s draws each section once, and opens on the hero", (theme) => {
    const sections = COMPOSITIONS[theme].sections.map((e) => e.section);
    expect(new Set(sections).size).toBe(sections.length);
    expect(sections[0]).toBe(SECTION.HERO);
  });

  it.each(THEME_KEYS)("%s carries the goods, deals and proof every theme owes (spec Theme cards)", (theme) => {
    const sections = COMPOSITIONS[theme].sections.map((e) => e.section);
    for (const owed of [SECTION.BEST_SELLING, SECTION.NEW_IN, SECTION.DEALS, SECTION.WHY_BUY, SECTION.VISIT]) {
      expect(sections, `${theme} lacks ${owed}`).toContain(owed);
    }
  });

  it("every declared variant is drawn by some theme — none is dead code", () => {
    const used = new Set(
      THEME_KEYS.flatMap((t) => COMPOSITIONS[t].sections.map((e) => `${e.section}.${e.variant}`)),
    );
    const declared = SECTION_KEYS.flatMap((s) => variantsOf(s).map((v) => `${s}.${v}`));
    expect(declared.filter((v) => !used.has(v))).toEqual([]);
  });

  it("each theme has its own card style", () => {
    const styles = THEME_KEYS.map((t) => COMPOSITIONS[t].cardStyle);
    expect(new Set(styles).size).toBe(THEME_KEYS.length);
    expect(styles.sort()).toEqual(Object.values(CARD_STYLE).sort());
  });

  it("themes differ in layout, not colour alone: at least three sections drawn differently, pairwise (A1)", () => {
    const drawn = (t: (typeof THEME_KEYS)[number]) =>
      new Map<string, string>(COMPOSITIONS[t].sections.map((e) => [e.section, e.variant]));
    for (const a of THEME_KEYS) {
      for (const b of THEME_KEYS) {
        if (a >= b) continue;
        const [da, db] = [drawn(a), drawn(b)];
        const differing = SECTION_KEYS.filter((s) => da.get(s) !== db.get(s));
        expect(differing.length, `${a} vs ${b}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("a shop may hide only its own words and picks, never proof or goods (Q9)", () => {
    expect([...HIDEABLE_SECTIONS].sort()).toEqual(
      [SECTION.COLLECTIONS, SECTION.STORY, SECTION.VISIT].sort(),
    );
  });
});

describe("a shop's heading font (storefront-font R1, R4, Q1, Q7; D1, D5)", () => {
  it("the list is the eight the owner chose", () => {
    expect([...FONT_KEYS].sort()).toEqual(
      ["cormorant", "dmsans", "jost", "marcellus", "mulish", "playfair", "poppins", "space"].sort(),
    );
  });

  it("a scope per font, and a font per scope, each pointing the display face at its family", () => {
    expect(scopeKeys("font").sort()).toEqual([...FONT_KEYS].sort());
    for (const key of FONT_KEYS) {
      const body = CSS.split(`[data-font="${key}"] {`)[1]?.split("}")[0] ?? "";
      const declarations = [...body.matchAll(/^\s*([\w-]+):\s*([^;]+);/gm)].map(([, k, v]) => `${k}: ${v}`);
      expect(declarations[0], key).toBe(`--font-display-face: var(${FONTS_LIST[key].variable})`);
      // A one-weight face may refuse a faked bold; nothing else (R3).
      expect(declarations.slice(1).every((d) => d === "font-synthesis-weight: none"), key).toBe(true);
    }
  });

  it("a font scope sets the face only, never a size, weight or case (storefront-font R3)", () => {
    for (const key of FONT_KEYS) {
      const body = CSS.split(`[data-font="${key}"] {`)[1]?.split("}")[0] ?? "";
      expect(body).not.toMatch(/--(?:text|spacing|font-display-weight|display-case)/);
    }
  });

  it.each(THEME_KEYS)("%s suggests its own face first, and only listed fonts", (theme) => {
    const suggested = SUGGESTED_FONTS[theme];
    expect(suggested[0]).toBe(defaultFont(theme));
    for (const key of suggested) expect(FONT_KEYS).toContain(key);
  });

  it("no font reads a role a theme repoints, so DM Sans is DM Sans inside Darbar too", () => {
    for (const key of FONT_KEYS) expect(FONTS_LIST[key].variable).not.toBe("--font-body-face");
  });

  it("an unknown or absent key reads as the template's default (null)", () => {
    expect(readFontKey("comic-sans")).toBeNull();
    expect(readFontKey(null)).toBeNull();
    expect(readFontKey("marcellus")).toBe("marcellus");
  });

  it("every theme's default face is on the list", () => {
    for (const theme of THEME_KEYS) expect(FONT_KEYS).toContain(defaultFont(theme));
  });
});
