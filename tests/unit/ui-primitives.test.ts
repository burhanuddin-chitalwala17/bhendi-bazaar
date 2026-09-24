/**
 * One components home, and one way to render a control (ADR-0027).
 *
 * The consolidation that produced this test found 64 raw `<button>`, 14 raw `<select>`
 * and 9 raw text inputs living beside primitives that already existed — each one a
 * focus ring, a disabled state and a token-driven shape re-implemented by hand, or more
 * often not re-implemented at all. A convention alone did not hold them; this does.
 *
 * Nothing here is about taste. A raw `<input>` misses `Input`'s 16px mobile base, which
 * is what stops iOS zooming the page on focus (ADR-0015) — so a bypass is a defect on a
 * phone, not an inconsistency.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const COMPONENT_ROOT = "src/components";
const PRIMITIVES = join(COMPONENT_ROOT, "ui");

/**
 * Homes dissolved by the consolidation. A component is placed by the domain it serves,
 * never by the audience that happens to call it — the same rule ADR-0012 sets for
 * `server/`. Admin and storefront share a product card; they do not share a folder.
 */
const DISSOLVED = ["src/admin", "src/org", "src/containers", "src/components/admin"];

function tsxFiles(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out = out.concat(tsxFiles(path));
    else if (entry.endsWith(".tsx")) out.push(path);
  }
  return out;
}

const exists = (path: string) => {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
};

/** Everything outside the primitives themselves, which must use raw elements. */
const consumers = [...tsxFiles(COMPONENT_ROOT), ...tsxFiles("src/app")].filter(
  (file) => !file.startsWith(PRIMITIVES)
);

describe("one components home", () => {
  it.each(DISSOLVED)("%s stays dissolved", (home) => {
    expect(exists(home)).toBe(false);
  });
});

describe("controls go through the primitives", () => {
  it("the scan reaches the files it claims to check", () => {
    // Every assertion below is "this list of offenders is empty". A scan that finds no files
    // produces an empty list too, and passes — which is how a broken glob becomes a green
    // guard. The floor makes the two outcomes distinguishable.
    expect(consumers.length).toBeGreaterThan(100);
  });

  it("has no raw <button>", () => {
    const offenders = consumers.filter((file) =>
      /<button\b/.test(readFileSync(file, "utf8"))
    );
    expect(offenders).toEqual([]);
  });

  it("has no raw <select>", () => {
    const offenders = consumers.filter((file) =>
      /<select\b/.test(readFileSync(file, "utf8"))
    );
    expect(offenders).toEqual([]);
  });

  /**
   * `type="file"` and `type="hidden"` stay raw and always will: a styled text field
   * cannot be a file picker, and a hidden field renders nothing to style. Every other
   * input is a control a user types into, and belongs to `Input`.
   */
  it("has no raw text input", () => {
    const offenders: string[] = [];
    for (const file of consumers) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/<input\b/g)) {
        const tag = source.slice(match.index, match.index + 240);
        if (/type="(file|hidden)"/.test(tag)) continue;
        offenders.push(`${file}:${source.slice(0, match.index).split("\n").length}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
