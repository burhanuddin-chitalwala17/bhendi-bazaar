/**
 * The named parts of a channel field, read off its type's JSON Schema (field-maps Q8, Q23): Amazon's
 * `item_dimensions` → length, width, height. A field in parts takes one map per part, never one answer.
 */

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});

/** What an item holds besides Amazon's `marketplace_id` and `language_tag`, when that is not one `value`. Empty for a one-answer field. */
export function partsOf(property: unknown): string[] {
  const keys = Object.keys(obj(obj(obj(property).items).properties)).filter((k) => k !== "marketplace_id" && k !== "language_tag");
  return keys.includes("value") ? [] : keys;
}

/** Every field of a type that is in parts, with its parts. Empty without a schema. */
export function partsByField(schema: unknown): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [name, property] of Object.entries(obj(obj(schema).properties))) {
    const parts = partsOf(property);
    if (parts.length > 0) out.set(name, parts);
  }
  return out;
}
