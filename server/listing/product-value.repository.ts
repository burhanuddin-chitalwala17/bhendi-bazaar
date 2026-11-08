import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@server/shared/prisma";

import { VALUE_SOURCE, type ProjectedValues, type ValueSource } from "./attribute.types";

type Db = Prisma.TransactionClient | typeof prisma;

/** The read copy, parsed: a row this code cannot read is no values, never a throw. */
const projectionSchema = z.record(z.string(), z.object({
  v: z.union([z.string(), z.number(), z.boolean()]),
  unit: z.string().optional(),
  src: z.enum(Object.values(VALUE_SOURCE) as [ValueSource, ...ValueSource[]]),
}));

/** A product's answers in the shape every reader already takes: facts and measurements, each `{ value, origin, … }`. */
export interface ProductAnswers {
  facts: Record<string, unknown>;
  measurements: Record<string, unknown>;
}

const EMPTY: ProductAnswers = { facts: {}, measurements: {} };

/**
 * The one reader and writer of a product's answers (listing-model/dynamic-form Q16; Invariant 5): ProductValue
 * and its read copy ProductValueSet. Writes run in the caller's transaction through the value functions, which
 * keep each answer verbatim beside its typed columns, so nothing a save sends is lost.
 */
export const productValueRepository = {
  /** A product's answers replaced by what it holds now; its inherited rows and read copy rebuilt (Q16). */
  async writeAnswersIn(db: Db, productId: string, answers: { facts?: unknown; measurements?: unknown; weight?: number | null }): Promise<void> {
    await db.$executeRaw`SELECT bb_write_answers(${productId}, ${JSON.stringify(answers.facts ?? {})}::jsonb, ${JSON.stringify(answers.measurements ?? {})}::jsonb, ${answers.weight ?? null}::double precision)`;
  },

  /**
   * Typed rows derived again from the answers each product holds, after its type, its category's type or its
   * type's units move (review S1). Runs in the caller's transaction, after that write.
   */
  async rederiveIn(db: Db, productIds: readonly string[]): Promise<void> {
    if (productIds.length === 0) return;
    await db.$executeRaw`SELECT bb_rederive_answers(id) FROM unnest(${[...productIds]}::text[]) AS id`;
  },

  /** Every product of a type, after the type's measures change. */
  async rederiveForTypeIn(db: Db, typeKey: string): Promise<void> {
    await db.$executeRaw`SELECT bb_rederive_answers("id") FROM "Product" WHERE "productType" = ${typeKey}`;
  },

  /** Every product in a category or beneath it, after the category's type or place changes (and its products re-type). */
  async rederiveForCategoryIn(db: Db, categoryId: string): Promise<void> {
    await db.$executeRaw`WITH RECURSIVE down AS (
        SELECT ${categoryId}::text AS id, 0 AS depth
        UNION ALL SELECT c."id", down.depth + 1 FROM "Category" c JOIN down ON c."parentId" = down.id WHERE down.depth < 20)
      SELECT bb_rederive_answers(p."id") FROM "Product" p WHERE p."categoryId" IN (SELECT id FROM down)`;
  },

  /** What the brand and the shop fill, rebuilt for some products after a brand, party or default changes. */
  async refreshInheritedIn(db: Db, productIds: readonly string[]): Promise<void> {
    if (productIds.length === 0) return;
    await db.$executeRaw`SELECT bb_write_inherited(id) FROM unnest(${[...productIds]}::text[]) AS id`;
  },

  /**
   * The products a brand fills: its own, and the shop's brandless ones while it is the shop's default (or was,
   * just now). Their inherited rows rebuilt in the caller's transaction (dynamic-form Q16).
   */
  async refreshForBrandIn(db: Db, brandId: string, wasDefault = false): Promise<void> {
    await db.$executeRaw`SELECT bb_write_inherited(p."id") FROM "Product" p JOIN "Brand" b ON b."id" = ${brandId}
      WHERE p."brandId" = b."id" OR (p."brandId" IS NULL AND p."orgId" = b."orgId" AND (b."isDefault" OR ${wasDefault}))`;
  },

  /** Every product of a shop, after its own defaults (the country of origin) change. */
  async refreshForShopIn(db: Db, orgId: string): Promise<void> {
    await db.$executeRaw`SELECT bb_write_inherited("id") FROM "Product" WHERE "orgId" = ${orgId}`;
  },

  /** Each product's answers, from the verbatim rows, in one read. A product with none reads as empty. */
  async answersFor(productIds: readonly string[], db: Pick<Db, "productValue"> = prisma): Promise<Map<string, ProductAnswers>> {
    const out = new Map<string, ProductAnswers>(productIds.map((id) => [id, { facts: {}, measurements: {} }]));
    if (productIds.length === 0) return out;
    const rows = await db.productValue.findMany({
      where: { productId: { in: [...productIds] }, NOT: { answer: { equals: Prisma.DbNull } } },
      select: { productId: true, attributeKey: true, answer: true, measured: true },
    });
    for (const r of rows) {
      const a = out.get(r.productId) ?? { facts: {}, measurements: {} };
      (r.measured ? a.measurements : a.facts)[r.attributeKey] = r.answer;
      out.set(r.productId, a);
    }
    return out;
  },

  async answersOf(productId: string, db: Pick<Db, "productValue"> = prisma): Promise<ProductAnswers> {
    return (await this.answersFor([productId], db)).get(productId) ?? EMPTY;
  },

  /** Each product's read copy (Q8), in one read. */
  async projections(productIds: readonly string[]): Promise<Map<string, ProjectedValues>> {
    if (productIds.length === 0) return new Map();
    const rows = await prisma.productValueSet.findMany({ where: { productId: { in: [...productIds] } }, select: { productId: true, values: true } });
    return new Map(rows.map((r) => [r.productId, projectionSchema.safeParse(r.values).data ?? {}]));
  },

  /** The stored kinds, for the guard that code handles every one (D1). */
  async kinds(): Promise<string[]> {
    return (await prisma.attribute.findMany({ distinct: ["kind"], select: { kind: true } })).map((a) => a.kind);
  },
};
