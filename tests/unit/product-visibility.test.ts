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
  "server/catalog/product.read.repository.ts": {
    reads: 29,
    note: "filtered — `checkoutFacts` prices an order's lines inside its transaction and deliberately sees archived rows: `assertNotArchived` is the refusal and it runs after the stock reservation (sale-gates.ts). Otherwise the storefront's own reads carry AVAILABLE and FROM_ACTIVE_ORG together, categoryIdsForOrg and isOnSale (which decides whether a product may be reviewed) included, plus archivedAmong and fromWithdrawnOrgAmong (which back the two sale gates and must therefore see the rows they refuse) and two ownership/pricing lookups that must see every row. isAvailable (wishlist's save) spreads AVAILABLE: an archived product cannot be newly saved, and wishes already saved are left alone so a restore brings them back. Two are deliberate: listForStockCheck selects archivedAt so an archived product comes back unavailable by name, letting the cart say which line is the problem, and listForAllocation is a parcel preview — the order transaction is what refuses, so it must still resolve the row it is asked about. getFamilySiblings filters archivedAt: null — a variant taken off sale does not appear in the switcher. listForChannelFeed spreads both: a channel feed lists only what a buyer could reach (shopfront-feeds R4). stockForPush (inventory-sync D3) is deliberate: an archived product must be read to send 0 to its marketplaces (Q6). forListing (channel-listings D3) is deliberate too: an archived product's marketplace listing still opens and computes. countOnSaleForOrg (a shop's Shop all {n}) and orgIdForSlug (whose chrome a product page keeps, storefront-themes D7) spread both, as does mainProductTypeForOrg (a shop's claim list and suggested theme, storefront-themes Q44)",
  },
  "server/catalog/product.repository.ts": {
    reads: 27,
    note: "the org portal: the list takes a shelf, the detail read sees archived products so they can be restored, the stats split the two figures, the copy picker lists the available shelf only, and the categories-sold-by read (which keys the listing defaults) excludes archived products so a shelf the org left stops asking for a tax code. The bulk import's two reads are deliberate — it checks SKUs and slugs against every row, archived included, so it cannot reuse a reserved code or silently restore a product; the third, `listLiveSkus`, asks the opposite question and so excludes archived rows: a live SKU names the product a sheet row updates, and an archived one must never be restored by an import. `countWhere` and `listFactsWhere` serve the fact correction, which deliberately reaches archived products too: an archived product keeps the answer it inherited and could be restored carrying a value its brand has since corrected; the preview and the update share one predicate so they cannot disagree (inherited-facts D5). `listWithSku` and `compareFacts` serve channel-import and see archived products on purpose: a marketplace listing links to an archived product and says so (channel-import Q4), and the details panel compares against whatever it is linked to. product-merge adds four that see archived products on purpose: `listForMatching` (a listing may be matched to an archived product, which then says so), `settleFacts` (the product being matched, whatever its shelf), the slug check inside `createInTransaction` (a slug is reserved by an archived product too) and the ownership check in `setImages` (photos land on the product the listing is linked to). marketplace-facts adds `marketplaceFacts`, which sees archived products on purpose: a linked listing fills the product it is linked to, whatever its shelf, and its card shows on that product's page. family-merge adds `familyMembers`, which sees archived members on purpose: a new member must not match one taken off sale, which still holds its colour in the family. product-form unit 4 adds `versionConflict`, which sees archived products on purpose: it only words a refused save of the product being edited, whatever its shelf. product-form unit 6 adds `teamEditedSummary` (a count and a first, both filtered): Home's \"Our team changed\" counts available products only, since one the shop archived since it has already acted on",
  },
  "server/analytics/dashboard.repository.ts": {
    reads: 1,
    note: "filtered — sellable inventory only; the revenue and order aggregates beside it are history and touch no product row",
  },
  "server/analytics/widgets.repository.ts": {
    reads: 1,
    note: "filtered — sellable inventory only",
  },
  "server/catalog/org.repository.ts": {
    reads: 1,
    note: "deliberate — guards org deletion, and Product.orgId is Restrict, so an archived product blocks it exactly as an on-sale one does",
  },
  "server/cart/cart.repository.ts": {
    reads: 1,
    note: "deliberate — drops lines whose product no longer exists; filtering here would delete a cart line for a withdrawn product, and a removed line cannot come back on restore",
  },
  "server/listing/product-family.repository.ts": {
    reads: 2,
    note: "filtered — families include AVAILABLE so only sellable products appear in a family listing",
  },
  "server/listing/product-readiness.repository.ts": {
    reads: 1,
    note: "filtered — readiness is computed for available products only",
  },
  "server/listing/product-type.repository.ts": {
    reads: 1,
    note: "filtered — type resolution includes available products only",
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
