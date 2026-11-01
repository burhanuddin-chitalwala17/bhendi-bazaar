/**
 * The theme registry and the CSS that renders it agree (storefront-themes A1, R1–R3; D1, D2, D5).
 *
 * A key in code with no scope renders the platform look under a theme's name; a scope with no
 * key is a palette no shop can reach. Compositions join this file in U2.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  FACE_VARIABLE,
  PALETTE,
  THEME,
  THEMES,
  THEME_KEYS,
  readStorefrontLook,
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
      "--text-headline", "--tracking-headline", "--spacing-section", "--spacing-grid",
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

  it("every type size keeps a rem floor and a rem term, never viewport-only (D2)", () => {
    const sizes = [...CSS.matchAll(/--text-(?:headline|title):\s*([^;]+);/g)].map((m) => m[1]);
    expect(sizes.length).toBeGreaterThan(4);
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
    const named = new Set(THEME_KEYS.flatMap((t) => Object.values(THEMES[t].faces)));
    const loadedVars = loaders.map(([, , body]) => body.match(/variable: "([\w-]+)"/)?.[1]);
    const expected = [...named].map((f) => FACE_VARIABLE[f]).filter((v) => v !== "--font-body-face");
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
