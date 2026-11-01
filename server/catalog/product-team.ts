/**
 * What a Bhendi Bazaar team save changed, in the order the shop should read it (product-form D11,
 * Q13, Q21): money first, then stock, then the rest. Pure, so the audit entry and its tests read one
 * rule. Money stays integer paise (Invariant 3); the shop's history formats it.
 */

/** The audit actions a team save records. Closed set, compared by constant. */
export const PRODUCT_TEAM_ACTION = {
  CREATED: "PRODUCT_TEAM_CREATED",
  UPDATED: "PRODUCT_TEAM_UPDATED",
} as const;

/** The refusal a team edit of an archived product meets (ADR-0029); "Restore" is the way through. */
export const ARCHIVED_REFUSAL = "This product is archived. Restore it to edit.";

type Value = string | number | boolean | null;

/** A product as the shop would compare it: plain values, money in paise. */
export interface TeamSnapshot {
  price: number;
  /** The shop's own markdown, null when none runs. */
  salePrice: number | null;
  /** Quantity per pickup location, keyed `name (id)`: two locations may share a name. */
  stock: Record<string, number>;
  name: string;
  description: string;
  category: string;
  sku: string | null;
  weight: number | null;
  lowStockThreshold: number | null;
  tags: string[];
  flags: string[];
  kind: string | null;
  familyId: string | null;
  brandId: string | null;
  facts: Record<string, Value>;
  measurements: Record<string, Value>;
  /** Gallery refs in order: a reorder is a change too. */
  media: string[];
}

export interface FieldChange {
  field: string;
  /** Which location, fact or measurement the field means, when it has more than one. */
  at?: string;
  before: Value;
  after: Value;
}

const MONEY = ["price", "salePrice"] as const;
const PLAIN = [
  "name",
  "description",
  "category",
  "sku",
  "weight",
  "lowStockThreshold",
  "kind",
  "familyId",
  "brandId",
] as const;
const LISTS = ["tags", "flags", "media"] as const;

const blank = (value: Value): Value => (value === "" ? null : value);
const list = (values: string[] | undefined) => (values && values.length ? values.join(", ") : null);

function keyed(field: string, before: Record<string, Value>, after: Record<string, Value>): FieldChange[] {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  return keys
    .map((at) => ({ field, at, before: before[at] ?? null, after: after[at] ?? null }))
    .filter((change) => change.before !== change.after);
}

/** Every field that differs; a create compares against nothing, so every filled field is listed. */
export function teamChanges(before: TeamSnapshot | null, after: TeamSnapshot): FieldChange[] {
  const plain = (field: (typeof MONEY)[number] | (typeof PLAIN)[number]): FieldChange => ({
    field,
    before: blank(before ? before[field] : null),
    after: blank(after[field]),
  });
  const changes: FieldChange[] = [
    ...MONEY.map(plain),
    ...keyed("stock", before?.stock ?? {}, after.stock),
    ...PLAIN.map(plain),
    ...LISTS.map((field) => ({ field, before: list(before?.[field]), after: list(after[field]) })),
    ...keyed("facts", before?.facts ?? {}, after.facts),
    ...keyed("measurements", before?.measurements ?? {}, after.measurements),
  ];
  return changes.filter((change) => change.before !== change.after);
}

/** Parsed stored answers (ADR-0051: parsed, never cast) read as their values. */
export function answersOf(parsed: Partial<Record<string, { value: Value }>>): Record<string, Value> {
  return Object.fromEntries(Object.entries(parsed).map(([key, entry]) => [key, entry?.value ?? null]));
}
