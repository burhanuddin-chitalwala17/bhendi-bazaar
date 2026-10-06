import { z } from "zod";

import {
  factKeySchema,
  measureKeySchema,
  UNITS,
  type FactKey,
  type MeasureKey,
  type Unit,
} from "./listing-facts";

/**
 * The shape of a product type, free of Prisma
 * ([product-types](../../docs/specs/listing-vocabulary/product-types/) D1).
 *
 * A type is a **selection** from the fact vocabulary, which is why it can be a row: the facts
 * themselves carry validation and a way of being answered and stay in code, and a list of their
 * keys is data. Akeneo and Shopify both draw the line in the same place.
 *
 * Kept Prisma-free so a page, a service and a test resolve a type identically — the same reason
 * `shot-list.ts` is pure.
 */

export const measureDeclarationSchema = z.object({
  key: measureKeySchema,
  label: z.string().trim().min(1).max(40),
  unit: z.enum(UNITS as unknown as [Unit, ...Unit[]]),
  required: z.boolean(),
});

export const kindSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9-]{0,39}$/, "A kind key is lowercase letters, digits and hyphens"),
  label: z.string().trim().min(1).max(60),
});

/** One step of a scale that turns a measurement into a label — a ring's diameter into a size. */
export const scaleStepSchema = z.object({
  value: z.number(),
  label: z.string().trim().min(1).max(20),
});

export const productTypeRecordSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9-]{0,39}$/, "A type key is lowercase letters, digits and hyphens"),
  label: z.string().trim().min(1).max(60),
  /** Fact keys, in the order the form shows them. One naming no declared fact is refused (D3). */
  facts: z.array(factKeySchema),
  measures: z.array(measureDeclarationSchema),
  /** Fact keys or measure keys; the two sets do not collide, so one list expresses both. */
  variantAxis: z.array(z.string().trim().min(1)),
  kinds: z.array(kindSchema),
  /** Where this type's trade uses another word for a shared fact — `Fabric` for `material`. */
  factLabels: z.partialRecord(factKeySchema, z.string().trim().min(1).max(40)),
  /** Which measurements a size label is read from; empty means the type has no notion of size. */
  labelFrom: z.array(measureKeySchema),
  /** A scale, when the label is a value rather than a word. Null means the free-size label. */
  labelScale: z.array(scaleStepSchema).nullable(),
});

export type MeasureDeclaration = z.infer<typeof measureDeclarationSchema>;
export type KindDeclaration = z.infer<typeof kindSchema>;
export type ScaleStep = z.infer<typeof scaleStepSchema>;
export type ProductTypeRecord = z.infer<typeof productTypeRecordSchema>;

/** Fact keys and measure keys do not collide, so one list expresses both kinds of axis. */
export type VariantAxis = FactKey | MeasureKey;

/**
 * A stored row read defensively. A row that does not parse reads as no type rather than
 * throwing: a malformed type must not take down every product form that mentions it, and the
 * integrity test is what catches it instead.
 */
export function parseProductTypeRecord(value: unknown): ProductTypeRecord | null {
  const parsed = productTypeRecordSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** The wording a type uses for a fact, which differs where its trade does (`Fabric`/`Material`). */
export function labelForFact(
  type: Pick<ProductTypeRecord, "factLabels">,
  fact: FactKey,
  fallback: string,
): string {
  return type.factLabels[fact] ?? fallback;
}
