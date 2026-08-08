// Colour reaches the UI through semantic tokens (globals.css) — primary, muted,
// destructive, success/warning/info, scrim, hero — never through raw Tailwind palette
// classes. A raw class pins one shade in one theme: it ignores dark mode (the
// EmailVerificationBanner hand-managed `dark:` overrides for exactly this reason) and
// makes a rebrand a 759-site hunt, which is what PR-33 cleaned up.
//
// The allowlist is for literals that are DATA, not styling.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const RAW_PALETTE = new RegExp(
  "\\b(?:hover:|dark:|focus:|group-hover:)?" +
    "(?:bg|text|border|ring|fill|stroke|from|to|via|divide|outline)-" +
    "(?:gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)" +
    "(?:-\\d+)?(?:/\\d+)?\\b",
  "g"
);

const ALLOWLIST = new Map([
  [
    "src/components/shared/forms/category/CategoryStylingFields.tsx",
    "ACCENT_COLORS values are stored in Category.accentColorClass rows — rewriting the options orphans the data. The real fix (a semantic key instead of a stored class) belongs to category-tree.",
  ],
]);

function tsxFiles(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out = out.concat(tsxFiles(path));
    else if (entry.endsWith(".tsx")) out.push(path);
  }
  return out;
}

describe("colour goes through tokens", () => {
  it("uses no raw palette class outside the allowlist", () => {
    const offenders: string[] = [];

    for (const file of tsxFiles("src")) {
      if (ALLOWLIST.has(file)) continue;
      const matches = readFileSync(file, "utf8").match(RAW_PALETTE);
      if (matches) offenders.push(`${file} — ${[...new Set(matches)].join(", ")}`);
    }

    expect(offenders).toEqual([]);
  });

  it("keeps the allowlist honest: entries must still contain what they excuse", () => {
    for (const [file, reason] of ALLOWLIST) {
      expect(reason.length).toBeGreaterThan(30);
      expect(readFileSync(file, "utf8").match(RAW_PALETTE)).not.toBeNull();
    }
  });

  it("keeps the tokens this suite relies on defined", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    for (const token of ["--color-success", "--color-warning", "--color-info", "--color-scrim", "--color-hero"]) {
      expect(css).toContain(token);
    }
  });
});
