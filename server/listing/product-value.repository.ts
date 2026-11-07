import { prisma } from "@server/shared/prisma";

import { z } from "zod";

import { VALUE_SOURCE, type ProjectedValues, type ValueSource } from "./attribute.types";

/** The read copy, parsed: a row the database wrote but this code cannot read is no values, never a throw. */
const projectionSchema = z.record(z.string(), z.object({
  v: z.union([z.string(), z.number(), z.boolean()]),
  unit: z.string().optional(),
  src: z.enum(Object.values(VALUE_SOURCE) as [ValueSource, ...ValueSource[]]),
}));

/**
 * Product values (listing-model/attributes D3). Until dynamic-form switches the writes, the rows are
 * derived by the database from today's answers (Q7), so this repository only reads; it becomes the one
 * writer then (Invariant 5).
 */
export const productValueRepository = {
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
