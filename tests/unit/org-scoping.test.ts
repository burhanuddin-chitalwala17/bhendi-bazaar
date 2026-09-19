/**
 * Every public product read is scoped to an active org, and a storefront listing to one
 * org (org-storefront R3, org-withdrawal R1/R2).
 *
 * This exists because it was missed once. `FROM_ACTIVE_ORG` and the storefront's
 * `orgId` both silently fell out of `getProducts` during a reformat: the edit that was
 * meant to restore them was a string replace that matched nothing, and a replace with
 * no match is a no-op rather than an error. The result was a storefront listing every
 * org's goods and a withdrawn org still on sale — with a green suite, because the census
 * test beside this one counts *reads per file* and never looks at what they filter on.
 *
 * So this asserts the clause itself, per read, two ways: by running each method against
 * a mocked client and by reading the source, since a `where` assembled at runtime and a
 * `where` written in the file can drift apart.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const findMany = vi.fn().mockResolvedValue([]);
const findFirst = vi.fn().mockResolvedValue(null);
const groupBy = vi.fn().mockResolvedValue([]);

vi.mock("@server/shared/prisma", () => ({
  prisma: {
    product: {
      findMany: (args: unknown) => findMany(args),
      findFirst: (args: unknown) => findFirst(args),
      groupBy: (args: unknown) => groupBy(args),
    },
  },
}));
vi.mock("@server/promotions/price-context", () => ({
  loadPriceContext: async () => ({ promotions: [], categoryParents: new Map() }),
}));
vi.mock("@server/promotions/targeting", () => ({
  offerCoverage: () => ({
    coversEverything: true,
    productIds: [],
    orgIds: [],
    categoryIds: [],
  }),
}));

const { productsRepository } = await import("@server/catalog/product.repository");

const ACTIVE_ORG = { org: { isActive: true } };
const lastWhere = (spy: typeof findMany) =>
  (spy.mock.calls.at(-1)?.[0] as { where?: Record<string, unknown> })?.where;

beforeEach(() => {
  findMany.mockClear();
  findFirst.mockClear();
});

describe("a buyer never sees a withdrawn org's goods", () => {
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
    expect(lastWhere(findMany)).toMatchObject(ACTIVE_ORG);
  });

  const singleReads: Array<[string, () => Promise<unknown>]> = [
    ["getProductById", () => productsRepository.getProductById("id-1")],
    ["getProductBySlug", () => productsRepository.getProductBySlug("a-slug")],
  ];

  it.each(singleReads)("%s filters on an active org", async (_name, call) => {
    await call();
    expect(lastWhere(findFirst)).toMatchObject(ACTIVE_ORG);
  });
});

describe("a storefront listing sees one shop", () => {
  it("narrows to the org it was given", async () => {
    await productsRepository.getProducts({ orgId: "org-1" });
    expect(lastWhere(findMany)).toMatchObject({ orgId: "org-1", ...ACTIVE_ORG });
  });

  it("does not narrow when the marketplace asks", async () => {
    await productsRepository.getProducts({});
    expect(lastWhere(findMany)).not.toHaveProperty("orgId");
  });

  it("keeps the org scope alongside a search and a category", async () => {
    // The bug this file exists for: a filter that survives alone but is displaced once
    // other clauses are spread in beside it.
    await productsRepository.getProducts({
      orgId: "org-1",
      search: "kurta",
      categoryIds: ["cat-1"],
    });
    expect(lastWhere(findMany)).toMatchObject({
      orgId: "org-1",
      ...ACTIVE_ORG,
      categoryId: { in: ["cat-1"] },
    });
  });

  it("keeps it alongside an offer filter, which rewrites the whole where", async () => {
    await productsRepository.getProducts({ orgId: "org-1", offerOnly: true });
    expect(lastWhere(findMany)).toMatchObject({ orgId: "org-1", ...ACTIVE_ORG });
  });
});

describe("the source says so too", () => {
  const source = readFileSync(
    join(process.cwd(), "server/catalog/product.repository.ts"),
    "utf8"
  );

  /** Reads a buyer reaches. Each must spread the org clause. */
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

  /** Scoped or privileged by other means, with the reason. */
  const EXEMPT: Record<string, string> = {
    listingFacts: "an org reading its own product, already scoped by orgId",
    listForPicker: "org/admin portal picker",
    listByIds: "admin/org promotion editor",
    listForPricing: "prices ids already held; the order transaction is the refusal",
    categoryIdsForOrg: "carries the clause, and is scoped by orgId besides",
  };

  const methods = source
    .split(/\n  (?:async |private static )/)
    .filter((block) => /prisma\.product\.(find|groupBy)/.test(block))
    .map((block) => block.match(/^([a-zA-Z0-9_]+)\s*[(<]/)?.[1])
    .filter((name): name is string => Boolean(name));

  it("classifies every product read", () => {
    const known = new Set([...PUBLIC_READS, ...Object.keys(EXEMPT)]);
    expect(methods.filter((name) => !known.has(name))).toEqual([]);
  });

  it.each(PUBLIC_READS)("%s spreads FROM_ACTIVE_ORG in the file", (name) => {
    const block = source.split(/\n  (?:async |private static )/).find((b) => b.startsWith(name));
    expect(block, `${name} is no longer in the repository`).toBeDefined();
    expect(block).toContain("FROM_ACTIVE_ORG");
  });
});
