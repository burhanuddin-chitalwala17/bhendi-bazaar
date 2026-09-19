/**
 * ADR-0026 decision 5: the compiler cannot catch a missing visibility clause — a query
 * without it is valid TypeScript returning valid rows, just rows a buyer should not
 * see. So it is checked here, two ways.
 *
 * The behavioural block proves each public read passes the clause today. The structural
 * block is the one that matters over time: it fails when somebody adds a *new* product
 * query to the public repository and does not spread the clause into it, which is the
 * failure mode a per-method test cannot see.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const findMany = vi.fn().mockResolvedValue([]);
const findFirst = vi.fn().mockResolvedValue(null);

vi.mock("@server/shared/prisma", () => ({
  prisma: {
    product: {
      findMany: (args: unknown) => findMany(args),
      findFirst: (args: unknown) => findFirst(args),
    },
  },
}));

// getOfferProducts resolves live offers before it builds its where; the clause must
// survive that merge rather than being overwritten by it.
vi.mock("@server/promotions/price-context", () => ({
  loadPriceContext: async () => ({ promotions: [], categoryParents: new Map() }),
}));
vi.mock("@server/promotions/targeting", () => ({
  offerCoverage: () => ({
    coversEverything: false,
    productIds: ["p1"],
    orgIds: [],
    categoryIds: [],
  }),
}));

const { productsRepository } = await import("@server/catalog/product.repository");

/** What every public read must carry. */
const CLAUSE = { org: { isActive: true } };

const lastWhere = (spy: typeof findMany) =>
  (spy.mock.calls.at(-1)?.[0] as { where?: Record<string, unknown> })?.where;

describe("public product reads carry the visibility clause", () => {
  beforeEach(() => {
    findMany.mockClear();
    findFirst.mockClear();
  });

  const listReads: Array<[string, () => Promise<unknown>]> = [
    ["listSlugs", () => productsRepository.listSlugs()],
    ["getProducts", () => productsRepository.getProducts({})],
    ["getSimilarProducts", () => productsRepository.getSimilarProducts("a-slug", 4)],
    ["getHeroProducts", () => productsRepository.getHeroProducts(6)],
    ["getOfferProducts", () => productsRepository.getOfferProducts(4)],
    ["searchProducts", () => productsRepository.searchProducts("kurta", 5)],
  ];

  it.each(listReads)("%s filters on an active org", async (_name, call) => {
    await call();
    expect(lastWhere(findMany)).toMatchObject(CLAUSE);
  });

  const singleReads: Array<[string, () => Promise<unknown>]> = [
    ["getProductById", () => productsRepository.getProductById("id-1")],
    ["getProductBySlug", () => productsRepository.getProductBySlug("a-slug")],
  ];

  it.each(singleReads)("%s filters on an active org", async (_name, call) => {
    await call();
    expect(lastWhere(findFirst)).toMatchObject(CLAUSE);
  });

  it("does not let a resolved offer filter displace the clause", async () => {
    await productsRepository.getOfferProducts(4);
    const where = lastWhere(findMany);
    // Both survive: the offer's own coverage (an OR over the products, categories and
    // orgs it reaches) and the visibility rule.
    expect(where).toMatchObject(CLAUSE);
    expect(where).toHaveProperty("OR");
  });
});

describe("no public product query escapes the clause", () => {
  const source = readFileSync(
    join(process.cwd(), "server/catalog/product.repository.ts"),
    "utf8"
  );

  /** Reads a buyer can reach. Every one of these must carry the clause. */
  const PUBLIC_READS = [
    "listSlugs",
    "getProducts",
    "getProductById",
    "getProductBySlug",
    "getSimilarProducts",
    "getHeroProducts",
    "getOfferProducts",
    "searchProducts",
  ];

  /**
   * Reads that must NOT carry it, each for a stated reason (ADR-0026 decision 3).
   * Being on this list is a claim that the caller is privileged or already holds the
   * ids — if that stops being true, the entry is the bug.
   */
  const EXEMPT: Record<string, string> = {
    // Scoped by orgId: an org reading its own product to build an offer or an event.
    listingFacts: "org's own product, already scoped by orgId",
    // The org and admin promotion pickers — portal surfaces, not storefront.
    listForPicker: "org/admin portal picker",
    // The promotion editors load the products an existing offer already names.
    listByIds: "admin/org promotion editor",
    // Prices ids the caller already holds. A withdrawn org's line should never be in
    // a basket to be quoted (org-withdrawal R6), and the authoritative refusal is the
    // order transaction, not this read (ADR-0026 decision 7).
    listForPricing: "prices ids already chosen; refusal lives in the order transaction",
  };

  /** Every method in the file that reaches for a product row. */
  const readingMethods = source
    .split(/\n  (?:async |private static )/)
    .filter((block) => /prisma\.product\.find/.test(block))
    .map((block) => block.match(/^([a-zA-Z0-9_]+)\s*[(<]/)?.[1])
    .filter((name): name is string => Boolean(name));

  it("classifies every product read as public or deliberately exempt", () => {
    const known = new Set([...PUBLIC_READS, ...Object.keys(EXEMPT)]);
    const unclassified = readingMethods.filter((name) => !known.has(name));
    // A new product read landed here without a decision about who may see its rows.
    // Add it to PUBLIC_READS (and spread the clause) or to EXEMPT (and say why).
    expect(unclassified).toEqual([]);
  });

  it("finds every public read still in the file", () => {
    for (const name of PUBLIC_READS) {
      expect(readingMethods).toContain(name);
    }
  });

  it("spreads the clause once per public read, plus the import", () => {
    const clauses = source.match(/PUBLIC_PRODUCT_WHERE/g) ?? [];
    expect(clauses.length).toBe(PUBLIC_READS.length + 1);
  });

  it("keeps the privileged repository free of it", () => {
    const admin = readFileSync(
      join(process.cwd(), "server/catalog/admin.product.repository.ts"),
      "utf8"
    );
    expect(admin).not.toContain("PUBLIC_PRODUCT_WHERE");
  });
});
