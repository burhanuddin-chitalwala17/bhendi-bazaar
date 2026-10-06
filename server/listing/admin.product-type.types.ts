import { z } from "zod";

import { FACTS, MEASURES, UNITS, type FactKey, type MeasureKey, type Unit } from "./listing-facts";
import { kindSchema, measureDeclarationSchema, scaleStepSchema } from "./product-type.types";

/**
 * The accepted shape of an admin product-type payload
 * ([product-types](../../docs/specs/listing-vocabulary/product-types/) R1).
 *
 * Creating a type is a design decision rather than data entry — choosing which of the declared
 * facts a product line needs — so the rules here are about internal consistency rather than
 * taste: a type may not ask for a fact nobody declared, vary on something it never asks about,
 * relabel a fact it does not ask, or read a size label from a measurement it does not take. Those
 * are the same four checks `tests/integration/product-type-table.test.ts` makes of the rows that
 * shipped, enforced here at the point a new one is written.
 *
 * `key` is absent from the update envelope on purpose: products and categories store it, so
 * renaming one would orphan every row that named it. It is set at creation and then frozen,
 * exactly as a slug is (Invariant 4).
 */

const factEnum = z.enum(FACTS as unknown as [FactKey, ...FactKey[]]);
const measureEnum = z.enum(MEASURES as unknown as [MeasureKey, ...MeasureKey[]]);

const rules = {
  key: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9-]{0,39}$/, "A key is lowercase letters, digits and hyphens"),
  label: z.string().trim().min(2, "Give the type a name").max(60),
  facts: z.array(factEnum).max(FACTS.length),
  measures: z.array(measureDeclarationSchema).max(MEASURES.length),
  variantAxis: z.array(z.string().trim().min(1)).max(6),
  kinds: z.array(kindSchema).min(1, "A type holds at least one kind").max(40),
  factLabels: z.partialRecord(factEnum, z.string().trim().min(1).max(40)),
  labelFrom: z.array(measureEnum).max(MEASURES.length),
  labelScale: z.array(scaleStepSchema).max(80).nullable(),
  order: z.number().int().min(0),
};

/** The shape the four coherence rules read — enough of either envelope to check it. */
interface Coherable {
  facts?: readonly string[];
  measures?: readonly { key: string }[];
  variantAxis?: readonly string[];
  factLabels?: Readonly<Record<string, string | undefined>>;
  labelFrom?: readonly string[];
}

/**
 * The four rules a type must satisfy to be internally consistent, applied to either envelope.
 *
 * These are the same checks `tests/integration/product-type-table.test.ts` makes of the rows that
 * shipped. There they catch a bad migration; here they catch a bad admin, which is the case that
 * starts mattering the moment the screen exists.
 */
function coherent<T extends z.ZodType<Coherable>>(schema: T) {
  return schema
    .refine(
      (v) => {
        const asked = new Set<string>([
          ...(v.facts ?? []),
          ...(v.measures ?? []).map((m) => m.key),
        ]);
        return (v.variantAxis ?? []).every((axis) => asked.has(axis));
      },
      { message: "A type can only vary on something it asks about", path: ["variantAxis"] },
    )
    .refine(
      (v) => Object.keys(v.factLabels ?? {}).every((fact) => (v.facts ?? []).includes(fact)),
      { message: "A type can only rename a fact it asks for", path: ["factLabels"] },
    )
    .refine(
      (v) => {
        const taken = new Set((v.measures ?? []).map((m) => m.key));
        return (v.labelFrom ?? []).every((key) => taken.has(key));
      },
      { message: "A size label can only be read from a measurement the type takes", path: ["labelFrom"] },
    )
    .refine((v) => new Set(v.facts ?? []).size === (v.facts ?? []).length, {
      message: "A fact is asked once",
      path: ["facts"],
    });
}

export const createProductTypeSchema = coherent(
  z.object({
    key: rules.key,
    label: rules.label,
    facts: rules.facts.default([]),
    measures: rules.measures.default([]),
    variantAxis: rules.variantAxis.default([]),
    kinds: rules.kinds,
    factLabels: rules.factLabels.default({}),
    labelFrom: rules.labelFrom.default([]),
    labelScale: rules.labelScale.default(null),
    order: rules.order.default(0),
  }),
);

/**
 * For PATCH. Every field is optional and none is defaulted — in zod v4 a default fires inside a
 * partial update and rewrites what the caller never mentioned, which is how a PATCH blanks a
 * field. `key` is absent entirely: it is frozen after creation.
 */
export const updateProductTypeSchema = coherent(
  z.object({
    label: rules.label.optional(),
    facts: rules.facts.optional(),
    measures: rules.measures.optional(),
    variantAxis: rules.variantAxis.optional(),
    kinds: rules.kinds.optional(),
    factLabels: rules.factLabels.optional(),
    labelFrom: rules.labelFrom.optional(),
    labelScale: rules.labelScale.optional(),
    order: rules.order.optional(),
  }),
);

export type CreateProductTypeInput = z.infer<typeof createProductTypeSchema>;
export type UpdateProductTypeInput = z.infer<typeof updateProductTypeSchema>;

export const ALL_UNITS: readonly Unit[] = UNITS;
