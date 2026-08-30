// Design decisions reach the UI through semantic tokens (globals.css), never through
// literals at the call site. A literal pins one value in one place: it ignores the
// theme, and it turns a redesign into a hundred-file hunt while a rebrand stays a
// one-file edit. Colour was governed this way from PR-33; ADR-0022 extended the same
// treatment to type, tracking, elevation, and page width.
//
// Allowlists are for literals that are DATA or a third party's property, not styling.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const CSS = readFileSync("src/app/globals.css", "utf8");

const RAW_PALETTE = new RegExp(
  "\\b(?:hover:|dark:|focus:|group-hover:)?" +
    "(?:bg|text|border|ring|fill|stroke|from|to|via|divide|outline)-" +
    "(?:gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)" +
    "(?:-\\d+)?(?:/\\d+)?\\b",
  "g"
);

/** `text-[0.7rem]` and friends — a font size invented at the call site. */
const ARBITRARY_TEXT = /\btext-\[[^\]]*(?:rem|px|em|ch)[^\]]*\]/g;
/** `tracking-[0.18em]` — the eyebrow treatment, respelled slightly differently. */
const ARBITRARY_TRACKING = /\btracking-\[[^\]]*\]/g;
/** Any hardcoded hex, whatever utility carries it. */
const RAW_HEX = /-\[#[0-9a-fA-F]{3,8}(?:\/\d+)?\]/g;
/** Tailwind's shadow scale answers "how big"; elevation roles answer "what is this". */
const RAW_SHADOW = /\bshadow-(?:xs|sm|md|lg|xl|2xl)\b/g;
/** A page container invented per page rather than taken from PageShell. */
const ADHOC_CONTAINER = /\bmx-auto\s+max-w-(?:xs|sm|md|lg|xl|\dxl)\b|\bmax-w-(?:xs|sm|md|lg|xl|\dxl)\s+mx-auto\b/g;

const RULES = [
  { name: "raw colour palette classes", pattern: RAW_PALETTE, fix: "use a semantic colour token" },
  { name: "arbitrary font sizes", pattern: ARBITRARY_TEXT, fix: "use a step on the type scale (text-4xs … text-3xl)" },
  { name: "arbitrary letter-spacing", pattern: ARBITRARY_TRACKING, fix: "use tracking-label / -eyebrow / -eyebrow-wide / -display" },
  { name: "hardcoded hex colours", pattern: RAW_HEX, fix: "use a token, or add it to the one module that owns that palette" },
  { name: "raw Tailwind shadows", pattern: RAW_SHADOW, fix: "use shadow-raised / -lifted / -overlay / -inset-field" },
  { name: "ad-hoc page containers", pattern: ADHOC_CONTAINER, fix: "use <PageShell width=…>" },
] as const;

// file -> the rules it is excused from, and why.
const ALLOWLIST: Record<string, { rules: readonly string[]; reason: string }> = {
  "src/lib/category-accent.ts": {
    rules: ["raw colour palette classes"],
    reason:
      "The accent palette is a closed decorative set keyed by CategoryAccent rows; the classes live only here so the database never holds them and Tailwind can scan them statically.",
  },
  "src/lib/social-brand.ts": {
    rules: ["hardcoded hex colours"],
    reason:
      "Third-party brand colours are not ours to theme — Facebook blue is Facebook blue in either mode — so they sit outside the token system, in one module rather than at the call site.",
  },
};

function sourceFiles(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out = out.concat(sourceFiles(path));
    else if (/\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

const FILES = sourceFiles("src");

describe("design decisions go through tokens", () => {
  it.each(RULES)("uses no $name outside the allowlist", ({ name, pattern, fix }) => {
    const offenders: string[] = [];
    for (const file of FILES) {
      if (ALLOWLIST[file]?.rules.includes(name)) continue;
      const matches = readFileSync(file, "utf8").match(pattern);
      if (matches) offenders.push(`${file} — ${[...new Set(matches)].join(", ")} — ${fix}`);
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the allowlist honest: entries must still contain what they excuse", () => {
    for (const [file, { rules, reason }] of Object.entries(ALLOWLIST)) {
      expect(reason.length).toBeGreaterThan(30);
      const source = readFileSync(file, "utf8");
      for (const name of rules) {
        const rule = RULES.find((r) => r.name === name);
        expect(rule, `unknown rule "${name}" in allowlist`).toBeDefined();
        expect(source.match(rule!.pattern), `${file} no longer needs its "${name}" exemption`).not.toBeNull();
      }
    }
  });

  it("keeps the tokens this suite relies on defined", () => {
    for (const token of [
      "--color-success", "--color-warning", "--color-info", "--color-scrim", "--color-hero",
      "--text-2xs", "--text-3xs", "--text-4xs",
      "--tracking-label", "--tracking-eyebrow", "--tracking-eyebrow-wide", "--tracking-display",
      "--shadow-raised", "--shadow-lifted", "--shadow-overlay", "--shadow-inset-field",
      "--radius-card", "--radius-field",
      "--container-page",
      "--font-heading",
    ]) {
      expect(CSS, `${token} is used by a utility but not defined`).toContain(token);
    }
  });
});

// `font-heading` sat in 20 files for months generating no CSS at all, because
// --font-heading was set by next/font but never registered as a theme token. A class
// that silently does nothing is worse than a wrong one: it looks applied.
describe("every font utility resolves to a real family", () => {
  const TAILWIND_BUILT_IN = new Set([
    "sans", "serif", "mono",
    "thin", "extralight", "light", "normal", "medium",
    "semibold", "bold", "extrabold", "black",
  ]);

  // `font-size` inside an inline SVG and `--font-heading-face` in next/font's config
  // are the same characters as a utility class without being one.
  const CSS_PROPERTY = new Set([
    "size", "family", "weight", "style", "variant", "stretch", "feature-settings",
    "variation-settings", "kerning", "optical-sizing", "smoothing",
  ]);

  const declared = new Set(
    [...CSS.matchAll(/^\s*--font-([a-z0-9-]+)\s*:/gm)].map((m) => m[1])
  );

  it("has no font-* class without a matching --font-* theme token", () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      for (const [, name] of readFileSync(file, "utf8").matchAll(/(?<![-\w])font-([a-z][a-z0-9-]*)\b/g)) {
        if (TAILWIND_BUILT_IN.has(name) || declared.has(name) || CSS_PROPERTY.has(name)) continue;
        offenders.push(`${file} — font-${name} generates no CSS`);
      }
    }
    expect([...new Set(offenders)]).toEqual([]);
  });
});
