/**
 * A locked storefront closes in each page, before any of its content is read (feature-access D11).
 * A layout that swaps its children does not stop them rendering into the payload (the framework's own
 * auth guide), so the gate must sit in every page under /store/[handle], ahead of its content reads.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");
const STORE = join(ROOT, "src/app/(store)/store/[handle]");
const PAGES = ["page.tsx", "shop/page.tsx", "about/page.tsx"];
// Reads that carry a storefront's content: its landing page, goods, brand page.
const CONTENT = /getStorefrontPage|getBrandPage|resolveBrandPage|productsDAL|storefrontPage\(|themedPageData/;

function defaultExportBody(source: string): string {
  const start = source.indexOf("export default async function");
  expect(start, "the page's default export").toBeGreaterThan(-1);
  return source.slice(start);
}

describe("a locked storefront closes before its content is read (feature-access D11)", () => {
  it.each(PAGES)("%s asks storefrontClosedTo before any content read", (page) => {
    const body = defaultExportBody(readFileSync(join(STORE, page), "utf8"));
    const gate = body.indexOf("storefrontClosedTo(");
    const content = body.search(CONTENT);
    expect(gate, "the page never closes itself").toBeGreaterThan(-1);
    if (content > -1) expect(gate, "content is read before the gate").toBeLessThan(content);
  });

  it("the layout never stands in as the gate", () => {
    const layout = readFileSync(join(STORE, "layout.tsx"), "utf8");
    expect(layout).not.toContain("<StorefrontClosed");
  });
});
