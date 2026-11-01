/**
 * Every storefront palette is readable (storefront-themes R12, A8; D4, Q16; ADR-0064 D4).
 *
 * Each `[data-palette]` scope is resolved to the primitives it points at, OKLCH is converted
 * to sRGB, and every text role must reach 4.5:1 on its ground, control edges 3:1. Text over a
 * photograph is checked on the photo scrim composited over white and black.
 * Mutation-tested by lightening one primitive (see the CHANGELOG entry for U1).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { PALETTE, PALETTE_TONE, THEMES } from "@server/catalog/storefront-themes";

const CSS = readFileSync("src/app/globals.css", "utf8");

type Rgb = [number, number, number];

function oklchToLinearSrgb(l: number, c: number, h: number): Rgb {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return [
    clamp(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    clamp(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    clamp(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  ];
}

const luminance = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function contrast(x: Rgb, y: Rgb): number {
  const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}

/** The primitive palette: `--name: oklch(L C H);` inside `:root` blocks. */
const PRIMITIVES = new Map<string, Rgb>(
  [...CSS.matchAll(/^\s*(--[a-z]+-\d+(?:-soft)?):\s*oklch\(([\d.]+) ([\d.]+) ([\d.]+)\);/gm)].map(
    ([, name, l, c, h]) => [name, oklchToLinearSrgb(Number(l), Number(c), Number(h))],
  ),
);

function scope(palette: string): string {
  const body = CSS.split(`[data-palette="${palette}"] {`)[1]?.split("}")[0];
  if (body === undefined) throw new Error(`no scope for palette ${palette}`);
  return body;
}

function resolve(palette: string, role: string): Rgb {
  const ref = scope(palette).match(new RegExp(`^\\s*--${role}:\\s*var\\((--[\\w-]+)\\);`, "m"))?.[1];
  if (!ref) throw new Error(`${palette} does not set --${role}`);
  const rgb = PRIMITIVES.get(ref);
  if (!rgb) throw new Error(`${palette} --${role} points at ${ref}, which is not a primitive`);
  return rgb;
}

/** [text role, ground role, minimum ratio] — WCAG AA text 4.5:1, non-text control 3:1. */
const PAIRS: ReadonlyArray<[string, string, number]> = [
  ["foreground", "background", 4.5],
  ["foreground", "muted", 4.5],
  ["card-foreground", "card", 4.5],
  ["popover-foreground", "popover", 4.5],
  ["muted-foreground", "background", 4.5],
  ["muted-foreground", "muted", 4.5],
  ["muted-foreground", "card", 4.5],
  ["primary-foreground", "primary", 4.5],
  ["secondary-foreground", "secondary", 4.5],
  ["accent-foreground", "accent", 4.5],
  ["deal-foreground", "deal", 4.5],
  ["feature-foreground", "feature", 4.5],
  ["input", "background", 3],
  ["input", "card", 3],
  ["ring", "background", 3],
  ["primary", "background", 4.5],
  // Status text: a palette's error, stock line or favourite reads off the page ground.
  ["destructive", "background", 4.5],
  ["success", "background", 4.5],
  ["warning", "background", 4.5],
  ["info", "background", 4.5],
  ["favorite", "background", 4.5],
];

const PALETTES = Object.values(PALETTE);

describe("every palette passes WCAG AA (A8)", () => {
  it("finds the primitives it resolves against", () => {
    expect(PRIMITIVES.size).toBeGreaterThan(80);
  });

  it.each(PALETTES)("%s", (palette) => {
    const failures = PAIRS.flatMap(([text, ground, min]) => {
      const ratio = contrast(resolve(palette, text), resolve(palette, ground));
      return ratio < min ? [`--${text} on --${ground}: ${ratio.toFixed(2)} < ${min}`] : [];
    });
    expect(failures).toEqual([]);
  });
});

describe("a palette is fixed light or dark (Q5)", () => {
  const tones = Object.values(THEMES).flatMap((t) => t.palettes);

  it.each(tones)("$key declares color-scheme $tone, and its ground agrees", ({ key, tone }) => {
    expect(scope(key)).toMatch(new RegExp(`color-scheme:\\s*${tone};`));
    const ground = luminance(resolve(key, "background"));
    expect(tone === PALETTE_TONE.DARK ? ground < 0.2 : ground > 0.5).toBe(true);
  });

  it("shared `dark:` styles never fire inside a palette", () => {
    const variant = CSS.match(/@custom-variant dark \((.+)\);/)?.[1] ?? "";
    expect(variant).toContain(":where(:not([data-palette], [data-palette] *))");
  });
});

describe("text over a photograph sits on the scrim (D4)", () => {
  const mix = CSS.match(/--color-photo-scrim:\s*color-mix\(in oklab, var\((--[\w-]+)\) (\d+)%, transparent\);/);
  const onPhoto = CSS.match(/--color-on-photo:\s*var\((--[\w-]+)\);/)?.[1];

  it.each([
    ["white", [1, 1, 1] as Rgb],
    ["black", [0, 0, 0] as Rgb],
  ])("over a %s photo", (_, photo) => {
    expect(mix, "--color-photo-scrim is a color-mix of a primitive").not.toBeNull();
    const ink = PRIMITIVES.get(mix![1])!;
    const alpha = Number(mix![2]) / 100;
    // Compositing in linear light is a close enough model of the browser's blend for a floor.
    const ground = ink.map((v, i) => v * alpha + photo[i] * (1 - alpha)) as Rgb;
    expect(contrast(PRIMITIVES.get(onPhoto!)!, ground)).toBeGreaterThanOrEqual(4.5);
  });
});
