import type { Prisma } from "@prisma/client";
import { prisma } from "@server/shared/prisma";
import { productValueRepository } from "./product-value.repository";

import type { CreateProductTypeInput, UpdateProductTypeInput } from "./admin.product-type.types";
import { parseProductTypeRecord, type ProductTypeRecord } from "./product-type.types";

/**
 * The one way to reach `ProductType` ([ADR-0003](../../docs/adr/0003-one-repository-per-aggregate.md)).
 *
 * Types are platform-wide, never per org
 * ([product-types](../../docs/specs/listing-vocabulary/product-types/) D11), so nothing here is
 * scoped by org — an admin defines them as an admin defines categories.
 *
 * Reads are small and few: a type list is tens of rows and the product form needs one of them.
 * That is why there is no cache — two indexed reads in a render that already queries the
 * category do not earn one, and this project deliberately has no caching layer.
 */

const SELECT = {
  key: true,
  label: true,
  facts: true,
  measures: true,
  variantAxis: true,
  kinds: true,
  factLabels: true,
  labelFrom: true,
  labelScale: true,
} as const;

type Row = Record<keyof typeof SELECT, unknown>;

/**
 * A row becomes a record, or null when it does not parse. A malformed type must not take down
 * every product form that mentions it; `tests/integration/product-type-table.test.ts` is what
 * notices instead.
 */
function toRecord(row: Row | null): ProductTypeRecord | null {
  if (!row) return null;
  return parseProductTypeRecord({
    key: row.key,
    label: row.label,
    facts: row.facts ?? [],
    measures: row.measures ?? [],
    variantAxis: row.variantAxis ?? [],
    kinds: row.kinds ?? [],
    factLabels: row.factLabels ?? {},
    labelFrom: row.labelFrom ?? [],
    labelScale: row.labelScale ?? null,
  });
}

export const productTypeRepository = {
  /** One type, by the key a product or a category stores. */
  async byKey(key: string | null | undefined): Promise<ProductTypeRecord | null> {
    if (!key) return null;
    const row = await prisma.productType.findUnique({ where: { key }, select: SELECT });
    return toRecord(row as Row | null);
  },

  /**
   * Several at once, for a screen showing products of mixed types. One query rather than one per
   * product, which is the difference between a list page costing two reads and costing fifty.
   */
  async byKeys(keys: readonly string[]): Promise<Map<string, ProductTypeRecord>> {
    const wanted = [...new Set(keys.filter((k): k is string => !!k))];
    if (wanted.length === 0) return new Map();
    const rows = await prisma.productType.findMany({ where: { key: { in: wanted } }, select: SELECT });
    const out = new Map<string, ProductTypeRecord>();
    for (const row of rows) {
      const record = toRecord(row as Row);
      if (record) out.set(record.key, record);
    }
    return out;
  },

  /**
   * What a picker offers. Retired types are hidden here and nowhere else — a product that already
   * names one must keep reading exactly as before
   * ([ADR-0032](../../docs/adr/0032-records-people-authored-are-retired-not-deleted.md)).
   */
  async list(includeRetired = false): Promise<ProductTypeRecord[]> {
    const rows = await prisma.productType.findMany({
      where: includeRetired ? {} : { retiredAt: null },
      orderBy: [{ order: "asc" }, { label: "asc" }],
      select: SELECT,
    });
    return rows.map((row) => toRecord(row as Row)).filter((r): r is ProductTypeRecord => r !== null);
  },

  /** Just the keys and labels — what a `<select>` needs, without the facts it will not render. */
  async options(): Promise<{ key: string; label: string }[]> {
    return prisma.productType.findMany({
      where: { retiredAt: null },
      orderBy: [{ order: "asc" }, { label: "asc" }],
      select: { key: true, label: true },
    });
  },

  /** Every key a write may legally store, which is what the schema factory validates against. */
  async keys(): Promise<string[]> {
    const rows = await prisma.productType.findMany({ select: { key: true } });
    return rows.map((r) => r.key);
  },

  async create(input: CreateProductTypeInput): Promise<ProductTypeRecord | null> {
    // Whitelisted field by field; create and update stay symmetric, and no request object is
    // spread into a Prisma `data` argument (Invariant 4).
    const row = await prisma.productType.create({
      data: {
        key: input.key,
        label: input.label,
        facts: [...input.facts],
        measures: input.measures as never,
        variantAxis: [...input.variantAxis],
        kinds: input.kinds as never,
        factLabels: input.factLabels as never,
        labelFrom: [...input.labelFrom],
        labelScale: (input.labelScale ?? undefined) as never,
        order: input.order,
      },
      select: SELECT,
    });
    return toRecord(row as Row);
  },

  /** `key` is absent on purpose: products and categories store it, so renaming orphans them. */
  async update(key: string, input: UpdateProductTypeInput): Promise<ProductTypeRecord | null> {
    const count = await prisma.$transaction(async (tx) => {
      const result = await tx.productType.updateMany({
      where: { key },
      data: {
        ...(input.label === undefined ? {} : { label: input.label }),
        ...(input.facts === undefined ? {} : { facts: [...input.facts] }),
        ...(input.measures === undefined ? {} : { measures: input.measures as never }),
        ...(input.variantAxis === undefined ? {} : { variantAxis: [...input.variantAxis] }),
        ...(input.kinds === undefined ? {} : { kinds: input.kinds as never }),
        ...(input.factLabels === undefined ? {} : { factLabels: input.factLabels as never }),
        ...(input.labelFrom === undefined ? {} : { labelFrom: [...input.labelFrom] }),
        ...(input.labelScale === undefined ? {} : { labelScale: input.labelScale as never }),
        ...(input.order === undefined ? {} : { order: input.order }),
      },
      });
      // A measure's unit moving changes every product's canonical number (review S1).
      if (result.count > 0 && input.measures !== undefined) await productValueRepository.rederiveForTypeIn(tx, key);
      return result.count;
    });
    if (count === 0) return null;
    return this.byKey(key);
  },

  async retire(key: string): Promise<boolean> {
    const { count } = await prisma.productType.updateMany({
      where: { key, retiredAt: null },
      data: { retiredAt: new Date() },
    });
    return count > 0;
  },

  async restore(key: string): Promise<boolean> {
    const { count } = await prisma.productType.updateMany({
      where: { key, retiredAt: { not: null } },
      data: { retiredAt: null },
    });
    return count > 0;
  },

  /** How many categories and products name a type — what a delete has to refuse. */
  async usage(key: string): Promise<{ categories: number; products: number }> {
    const [categories, products] = await Promise.all([
      prisma.category.count({ where: { productType: key } }),
      prisma.product.count({ where: { productType: key } }),
    ]);
    return { categories, products };
  },
  /**
   * Add facts a type does not ask yet, at the end of its form, inside a caller's transaction
   * (setup-requests D6). One statement per fact, appended only while absent, so two Applies at once
   * each keep the other's facts.
   */
  async addFacts(key: string, facts: readonly string[], db: Prisma.TransactionClient | typeof prisma = prisma): Promise<void> {
    for (const fact of facts) {
      await db.$executeRaw`UPDATE "ProductType" SET "facts" = array_append("facts", ${fact}) WHERE "key" = ${key} AND NOT (${fact} = ANY("facts"))`;
    }
  },
};
