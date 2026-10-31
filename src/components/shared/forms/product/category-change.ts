import { answered } from "@server/listing/fill-facts";
import { FACT_DECLARATIONS, type FactKey } from "@server/listing/listing-facts";
import { holdsKind } from "@server/listing/product-type";
import { labelForFact, type ProductTypeRecord } from "@server/listing/product-type.types";
import type { ProductFormInput } from "@/components/product/console/types";

type Answers = Pick<ProductFormInput, "facts" | "measurements" | "kind">;

/**
 * The answers typed for `from` that `to` does not ask, in `from`'s own words (product-form D5, R6).
 * A category with no type asks nothing, so every answer is lost there.
 */
export function answersLost(values: Answers, from: ProductTypeRecord | null, to: ProductTypeRecord | null): string[] {
  if (!from || from.key === to?.key) return [];
  const lost: string[] = [];
  for (const fact of from.facts) {
    if (!to?.facts.includes(fact) && answered(values.facts?.[fact])) {
      lost.push(labelForFact(from, fact, FACT_DECLARATIONS[fact]?.label ?? fact));
    }
  }
  const asked = new Set(to?.measures.map((measure) => measure.key));
  for (const measure of from.measures) {
    if (!asked.has(measure.key) && answered(values.measurements?.[measure.key])) lost.push(measure.label);
  }
  if (values.kind && !holdsKind(to, values.kind)) lost.push("Kind");
  return lost;
}

/**
 * What a save sends and validates: only what the chosen type asks (D5), nothing for a category with
 * no type. Answers for another type stay in the form until here, so switching back restores them.
 */
export function keepAsked<T extends Answers>(values: T, type: ProductTypeRecord | null): T {
  const kind = holdsKind(type, values.kind) ? values.kind : null;
  const facts = Object.fromEntries(
    Object.entries(values.facts ?? {}).filter(([fact]) => !!type?.facts.includes(fact as FactKey)),
  );
  const asked = new Set<string>(type?.measures.map((measure) => measure.key));
  const measurements = Object.fromEntries(
    Object.entries(values.measurements ?? {}).filter(([key]) => asked.has(key)),
  );
  return { ...values, kind, facts, measurements };
}

/** "a ring", "an abaya" — the sheet's "{a new}" (ux.md copy deck). */
export function withArticle(name: string): string {
  const lower = name.toLowerCase();
  return `${/^[aeiou]/.test(lower) ? "an" : "a"} ${lower}`;
}

/** The category sheet's copy, exactly as ux.md's copy deck words it. */
export const CATEGORY_SHEET = {
  title: (to: string) => `Change to ${to}?`,
  body: (lost: readonly string[], to: string) => `${lost.join(", ")} won't apply to ${withArticle(to)}.`,
  keep: (from: string) => `Keep ${from}`,
  change: (to: string) => `Change to ${to}`,
};
