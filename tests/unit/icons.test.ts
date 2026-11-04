/**
 * Every icon goes through one seam (ADR-0066 D3–D5).
 *
 * Icons were imported straight from a library into 209 files, so one visual decision lived
 * everywhere and drifted into near-duplicates (two check-circles, two warnings). Now only
 * `src/components/ui/icons/` names a library; everything else asks `<Icon name>` for a meaning.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import { createElement } from "react";

import { Icon } from "@/components/ui/icon";

const ICON_HOME = "src/components/ui/icons/";
const LIBRARY_IMPORT = /from\s+["'](lucide-react|@phosphor-icons\/[^"']+)["']/;


function sourceFiles(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out = out.concat(sourceFiles(path));
    else if (/\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

const files = sourceFiles("src");
const importers = files.filter((f) => LIBRARY_IMPORT.test(readFileSync(f, "utf8")));

describe("icons go through the one seam", () => {
  it("the scan reaches the seam itself", () => {
    expect(importers).toContain("src/components/ui/icons/registry.ts");
  });

  // The lucide ratchet emptied on 2026-11-04 and was removed with the package.
  it("only ui/icons/ imports an icon library", () => {
    const offenders = importers.filter((f) => !f.startsWith(ICON_HOME));
    expect(offenders).toEqual([]);
  });
});

describe("an icon is decoration or a name, never neither", () => {
  it("is hidden from assistive technology without a label", () => {
    const { container } = render(createElement(Icon, { name: "close" }));
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("is named with one", () => {
    const { container } = render(createElement(Icon, { name: "close", label: "Close" }));
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-label")).toBe("Close");
  });

  it("does the same for a brand drawing", () => {
    const { container } = render(createElement(Icon, { name: "bag", label: "Bag" }));
    expect(container.querySelector("svg.bb-icon")?.getAttribute("aria-label")).toBe("Bag");
  });
});
