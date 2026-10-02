/**
 * A product leaves sale by archiving (ADR-0029), and the rule has to hold at every
 * place that reads a product — roughly thirty-five of them across a dozen files.
 *
 * Some must exclude archived products and some must keep them: an order's own lines,
 * the slug pool an import checks against, and the count guarding org deletion are all
 * wrong if they forget an archived product exists. A rule enforced by memory at that
 * many call sites is missed at one, so this file pins the census. Adding a product
 * query fails it until the new site is classified here — which is the point: the
 * decision is cheap, and forgetting it leaks an archived product onto the storefront.
 *
 * Same approach as `vocabulary.test.ts` and `design-tokens.test.ts`: read the source.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ARCHIVED, AVAILABLE, shelfFilter } from "@server/catalog/product.visibility";

const ROOTS = ["server", "src"];
const SKIP_DIRS = new Set(["node_modules", ".next", "migrations"]);
const READ_CALL = /\b(?:prisma|tx|db)\.product\.(?:findMany|findFirst|findUnique|count|aggregate|groupBy)/g;

/**
 * Every file holding a product read, with how many it holds and why.
 *
 * `filtered` — spreads the AVAILABLE fragment (or the org's chosen shelf).
 * `deliberate` — reads archived products on purpose; the reason is the note.
 */
const CENSUS: Record<string, { reads: number; note: string }> = {
  "server/catalog/product.repository.ts": {
    reads: 18,
    note: "filtered — the storefront's own reads carry AVAILABLE and FROM_ACTIVE_ORG together, categoryIdsForOrg and isOnSale (which decides whether a product may be reviewed) included, plus archivedAmong and fromWithdrawnOrgAmong (which back the two sale gates and must therefore see the rows they refuse) and two ownership/pricing lookups that must see every row",
  },
  "server/catalog/admin.product.repository.ts": {
    reads: 11,
    note: "the org portal: the list takes a shelf, the detail read sees archived products so they can be restored, the stats split the two figures, the copy picker lists the available shelf only, and the categories-sold-by read (which keys the listing defaults) excludes archived products so a shelf the org left stops asking for a tax code",
  },
  "server/catalog/product-type.repository.ts": {
    reads: 1,
    note: "deliberate — `usage` counts every product naming a type, archived included, because it answers whether a type may be deleted and an archived product still holds its key (product-types D8)",
  },
  "server/catalog/product-family.repository.ts": {
    reads: 2,
    note: "the two counts a family screen needs (variants D6): the sellable count spreads AVAILABLE because it is what a shop is told it has on sale, while memberCount deliberately counts archived members too — it previews which products a correction at family level would change, and an archived product can be restored",
  },
  "server/catalog/bulk/bulk-product.service.ts": {
    reads: 2,
    note: "deliberate — an import checks SKUs and slugs against every row, archived included, so it cannot reuse a reserved code or silently restore a product",
  },
  "server/analytics/dashboard.repository.ts": {
    reads: 2,
    note: "filtered — inventory and top-products are about what is sellable; the revenue and order aggregates beside them are history and touch no product row",
  },
  "server/analytics/widgets.ts": {
    reads: 1,
    note: "filtered — sellable inventory only",
  },
  "src/app/api/products/check-stock/route.ts": {
    reads: 1,
    note: "deliberate — selects archivedAt so an archived product comes back unavailable by name, which is what lets the cart say which line is the problem",
  },
  "src/app/api/checkout/allocate/route.ts": {
    reads: 1,
    note: "deliberate — a parcel preview; the order transaction is what refuses, so this must still resolve the row it is asked about",
  },
  "server/wishlist/wishlist.service.ts": {
    reads: 1,
    note: "filtered — an archived product cannot be newly saved; wishes already saved are left alone so a restore brings them back",
  },
  "server/checkout/order.service.ts": {
    reads: 1,
    note: "deliberate — prices the lines from the catalogue inside the transaction; assertNotArchived is the refusal, and it runs after the stock reservation",
  },
  "server/catalog/org.repository.ts": {
    reads: 1,
    note: "deliberate — guards org deletion, and Product.orgId is Restrict, so an archived product blocks it exactly as an on-sale one does",
  },
  "server/cart/cart.repository.ts": {
    reads: 1,
    note: "deliberate — drops lines whose product no longer exists; filtering here would delete a cart line for a withdrawn product, and a removed line cannot come back on restore",
  },
};

function sourceFiles(dir: string): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out = out.concat(sourceFiles(path));
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

function readCensus(): Record<string, number> {
  const found: Record<string, number> = {};
  for (const root of ROOTS) {
    for (const file of sourceFiles(root)) {
      const matches = readFileSync(file, "utf8").match(READ_CALL);
      if (matches) found[file.split("\\").join("/")] = matches.length;
    }
  }
  return found;
}

describe("every product read is classified (ADR-0029)", () => {
  const found = readCensus();

  it("has no product read in a file this census does not know about", () => {
    const unknown = Object.keys(found).filter((file) => !(file in CENSUS));
    expect(
      unknown,
      "A new file reads products. Decide whether it is buyer-facing — if so spread AVAILABLE " +
        "from server/catalog/product.visibility.ts — then add it to CENSUS with the reason."
    ).toEqual([]);
  });

  it("has not gained or lost a read in a file it does know about", () => {
    const drifted = Object.entries(CENSUS)
      .filter(([file, { reads }]) => (found[file] ?? 0) !== reads)
      .map(([file, { reads }]) => `${file}: expected ${reads}, found ${found[file] ?? 0}`);
    expect(
      drifted,
      "A product read was added or removed. If added, decide whether it must exclude " +
        "archived products, then update its CENSUS count and note."
    ).toEqual([]);
  });

  it("states a reason for every file in the census", () => {
    for (const [file, { note }] of Object.entries(CENSUS)) {
      expect(note.length, `${file} needs a reason, not a placeholder`).toBeGreaterThan(20);
    }
  });
});

describe("the visibility fragments", () => {
  it("treats absence of a timestamp as on sale", () => {
    expect(AVAILABLE).toEqual({ archivedAt: null });
  });

  it("asks for a present timestamp when listing archived products", () => {
    expect(ARCHIVED).toEqual({ archivedAt: { not: null } });
  });

  it("defaults the org's shelf to available, so archived products are opt-in", () => {
    expect(shelfFilter()).toEqual(AVAILABLE);
    expect(shelfFilter("available")).toEqual(AVAILABLE);
  });

  it("spreads nothing for `all`, so neither shelf is excluded", () => {
    expect(shelfFilter("all")).toEqual({});
  });

  it("is a plain object, so spreading it cannot drop a caller's other conditions", () => {
    const combined = { categoryId: "c1", ...AVAILABLE };
    expect(combined).toEqual({ categoryId: "c1", archivedAt: null });
  });
});
