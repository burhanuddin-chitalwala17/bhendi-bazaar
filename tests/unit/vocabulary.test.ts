// A 57-file rename stays done only if something checks. "Seller" became "Org" in
// PR-23; without this, the next person to add a vendor-facing feature reintroduces the
// old word in one file and nothing notices until the vocabulary has drifted again —
// which is how `ProductFlag` came to be declared three times.
//
// Prisma migrations are exempt: they are an applied history and must never be edited.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["src", "server", "prisma"];
const SKIP_DIRS = new Set(["migrations", "node_modules", ".next"]);
const EXTS = [".ts", ".tsx"];

/**
 * A marketplace's own names, which we must spell as it does (channel-connectors): Amazon's consent
 * host and Sellers API path, Flipkart's OAuth scope, and, in the signed-off copy, the marketplace's
 * product "Seller Central" (and Flipkart's "Seller Hub", channel-listings Q4), its "seller account", and Amazon's own wording that it "asks sellers"
 * to re-approve; and the listing reads' field names: Amazon's `seller-sku` report column, Flipkart's
 * `/sellers` API root and its `sellerId` field, and Amazon's order item field `SellerSKU` (inventory-sync D4); and
 * schema.org's `Offer.seller` property, which schema.org names so (GTM B10). Removed from a line before it is scanned, so the retired word in our own prose
 * beside them is still caught. Our own word for a shop stays "org" or "shop".
 */
/** Only where the channel code lives; anywhere else the retired word is caught as before. */
const EXTERNAL_IDENTIFIER_FILES = /(^|\/)(server\/channels\/|src\/components\/channel\/(channel|platform-listing)-copy\.ts$|src\/lib\/structured-data\.ts$)/;
const EXTERNAL_IDENTIFIERS =
  /sellercentral\.amazon\.[a-z.]+|\/sellers\/v1\/|"Seller_Api"|Seller Central|Seller Hub|seller account|asks sellers|"seller-sku"|api\.flipkart\.net\/sellers|item\.sellerId|item\.SellerSKU|\bseller: \{ "@type"/gi;

/** Retired words, and what replaced them. */
const RETIRED: Record<string, string> = {
  seller: "org",
};

function sourceFiles(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out = out.concat(sourceFiles(path));
    else if (EXTS.some((e) => entry.endsWith(e))) out.push(path);
  }
  return out;
}

describe("retired vocabulary does not come back", () => {
  it("the scan reaches the files it claims to check", () => {
    // Every assertion below is "this list of offenders is empty". A scan that finds no files
    // produces an empty list too, and passes — which is how a broken glob becomes a green
    // guard. The floor makes the two outcomes distinguishable.
    expect(ROOTS.flatMap((root) => sourceFiles(root)).length).toBeGreaterThan(200);
  });

  for (const [retired, replacement] of Object.entries(RETIRED)) {
    it(`"${retired}" appears nowhere in source — use "${replacement}"`, () => {
      const offenders: string[] = [];
      const pattern = new RegExp(retired, "i");

      for (const root of ROOTS) {
        for (const file of sourceFiles(root)) {
          readFileSync(file, "utf8")
            .split("\n")
            .forEach((line, i) => {
              const scanned = EXTERNAL_IDENTIFIER_FILES.test(file) ? line.replace(EXTERNAL_IDENTIFIERS, "") : line;
              if (pattern.test(scanned)) offenders.push(`${file}:${i + 1}`);
            });
        }
      }

      expect(offenders).toEqual([]);
    });
  }

  it("also catches it in a path, not just an identifier", () => {
    expect(/seller/i.test("src/components/sellersContainer/index.tsx")).toBe(true);
    expect(/seller/i.test("src/components/orgsContainer/index.tsx")).toBe(false);
  });
});
