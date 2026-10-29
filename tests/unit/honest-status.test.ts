// A missing page answers 404 (seo R7): a Suspense or loading.tsx above it streams a 200 before
// notFound() runs (Next's loading.md, "Status Codes"). Search Console caught it on 2026-10-29.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const APP = resolve(__dirname, "../../src/app");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const files = walk(APP);
const layouts = files.filter((f) => f.endsWith("/layout.tsx"));
const notFoundPages = files.filter(
  (f) => f.endsWith("/page.tsx") && /\bnotFound\(\)/.test(readFileSync(f, "utf8")),
);

/** Every folder from the page's own up to src/app. */
function ancestors(file: string): string[] {
  const dirs: string[] = [];
  for (let dir = dirname(file); dir.startsWith(APP); dir = dirname(dir)) dirs.push(dir);
  return dirs;
}

describe("a page that can be missing can answer 404", () => {
  it("the scan reaches the files it claims to check", () => {
    expect(layouts).toContain(join(APP, "layout.tsx"));
    expect(notFoundPages).toContain(join(APP, "(main)/product/[slug]/page.tsx"));
    expect(notFoundPages).toContain(join(APP, "(main)/category/[slug]/page.tsx"));
  });

  it("no layout wraps its children in Suspense", () => {
    const offenders = layouts.filter((f) =>
      // Attributes may hold JSX (`fallback={<X />}`), so a `>` inside braces is skipped.
      /<Suspense\b(?:[^>{}]|\{[^}]*\})*>\s*\{\s*children\s*\}/.test(readFileSync(f, "utf8")),
    );
    expect(offenders.map((f) => relative(APP, f))).toEqual([]);
  });

  it("no loading.tsx sits above a storefront page that calls notFound()", () => {
    // Portal pages are not crawled, so a skeleton there costs no ranking.
    const offenders = notFoundPages
      .filter((page) => !/\/\((org|admin)\)\//.test(page))
      .flatMap((page) =>
        ancestors(page)
          .filter((dir) => existsSync(join(dir, "loading.tsx")))
          .map((dir) => `${relative(APP, page)} under ${relative(APP, dir)}/loading.tsx`),
      );
    expect(offenders).toEqual([]);
  });
});
