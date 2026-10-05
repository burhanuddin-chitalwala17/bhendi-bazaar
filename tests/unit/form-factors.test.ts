// Three form factors on Tailwind's own breakpoints (ADR-0050): phone at base, tablet from
// `md`, desktop from `lg`. A media query written by hand — an image `sizes` string, a
// matchMedia call — must name one of them, or the script and the stylesheet disagree about
// which device they are on.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { FORM_FACTOR_QUERY } from "@/hooks/core/useMediaQuery";

function sourceFiles(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out = out.concat(sourceFiles(path));
    else if (/\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

/** `sm` (640px) is the large phone held sideways: a refinement of the phone, not a fourth form. */
const BREAKPOINTS_PX = new Set([640, 768, 1024]);

describe("form factors", () => {
  const files = sourceFiles("src");
  const queries = files.flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(/\((?:min|max)-width:\s*(\d+)px\)/g)].map((m) => ({
      file,
      px: Number(m[1]),
    })),
  );

  it("finds the media queries it guards", () => {
    expect(queries.length).toBeGreaterThan(5);
  });

  it("every hand-written media query names a declared breakpoint", () => {
    expect(queries.filter((q) => !BREAKPOINTS_PX.has(q.px))).toEqual([]);
  });

  it("the script's form factors are Tailwind's md and lg", () => {
    expect(FORM_FACTOR_QUERY).toEqual({ tablet: "(min-width: 768px)", desktop: "(min-width: 1024px)" });
  });

  it("no stylesheet redefines a breakpoint", () => {
    expect(readFileSync("src/app/globals.css", "utf8")).not.toMatch(/--breakpoint-/);
  });
});
