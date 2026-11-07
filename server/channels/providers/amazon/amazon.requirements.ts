import { FIELD_REQUIREMENT, type FieldRequirement } from "../publish";

/**
 * How strongly an Amazon type asks each attribute of the one listing channel-catalogue Q3 judges by: a
 * standalone, shop-shipped, new product page on amazon.in. Each `allOf` rule's `if` is evaluated
 * against that listing in three values; a rule that holds requires, one that may hold is conditional.
 */

/** Attributes that listing never carries: it is no variation family and claims no existing page. */
const ABSENT = new Set(["merchant_suggested_asin", "parentage_level", "child_parent_sku_relationship", "variation_theme"]);
/** Attributes every create sends whatever the product (amazonCreateBody). */
const PRESENT = new Set([
  "item_name", "brand", "bullet_point", "product_description", "main_product_image_locator", "purchasable_offer",
  "fulfillment_availability", "condition_type", "country_of_origin",
]);
/** Keywords that annotate and constrain nothing. */
const INERT = new Set(["$comment", "description", "title", "$id", "examples"]);

/** true, false, or null where the answer depends on what the product holds. */
type Tri = boolean | null;

const obj = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function and(values: Tri[]): Tri {
  if (values.includes(false)) return false;
  return values.every((v) => v === true) ? true : null;
}
function or(values: Tri[]): Tri {
  if (values.includes(true)) return true;
  return values.length > 0 && values.every((v) => v === false) ? false : null;
}
const not = (value: Tri): Tri => (value === null ? null : !value);

const presence = (key: string): Tri => (ABSENT.has(key) ? false : PRESENT.has(key) ? true : null);

/** Whether the listing satisfies a condition schema. Anything not understood is unknown, never assumed. */
export function holds(schema: unknown): Tri {
  if (schema === true) return true;
  if (schema === false) return false;
  return and(Object.entries(obj(schema)).flatMap(([keyword, value]): Tri[] => {
    if (INERT.has(keyword)) return [];
    switch (keyword) {
      case "required":
        return [and(list(value).map((k) => presence(String(k))))];
      case "properties":
        // A constraint on an attribute the listing lacks holds vacuously, as JSON Schema says.
        return [and(Object.entries(obj(value)).map(([k, sub]) => (ABSENT.has(k) || Object.keys(obj(sub)).length === 0 ? true : null)))];
      case "not":
        return [not(holds(value))];
      case "allOf":
        return [and(list(value).map(holds))];
      case "anyOf":
        return [or(list(value).map(holds))];
      case "oneOf": {
        const each = list(value).map(holds);
        if (each.includes(null)) return [null];
        return [each.filter(Boolean).length === 1];
      }
      default:
        return [null];
    }
  }));
}

const RANK: Record<FieldRequirement, number> = { optional: 0, conditional: 1, required: 2 };

/** Required where a rule holds for the Q3 listing, conditional where it may or holds for another, else optional. */
export function amazonRequirements(schema: Record<string, unknown>): Map<string, FieldRequirement> {
  const out = new Map<string, FieldRequirement>();
  const raise = (key: string, requirement: FieldRequirement) => {
    if (RANK[requirement] > RANK[out.get(key) ?? FIELD_REQUIREMENT.OPTIONAL]) out.set(key, requirement);
  };
  const asks = (when: Tri) => (when === true ? FIELD_REQUIREMENT.REQUIRED : FIELD_REQUIREMENT.CONDITIONAL);

  // A rule that never applies to the Q3 listing still applies to some listing (a parent, a theme): conditional.
  const apply = (branch: unknown, when: Tri) => {
    const b = obj(branch);
    for (const key of list(b.required)) raise(String(key), asks(when));
    // One of several alternatives: none of them is required on its own.
    for (const alt of [...list(b.anyOf), ...list(b.oneOf)]) apply(alt, when === false ? false : null);
    for (const rule of list(b.allOf)) walk(rule, when);
  };
  const walk = (rule: unknown, when: Tri) => {
    const r = obj(rule);
    if (!("if" in r)) return apply(r, when);
    const cond = holds(r.if);
    apply(r.then, and([when, cond]));
    apply(r.else, and([when, not(cond)]));
  };

  apply({ required: schema.required, allOf: schema.allOf }, true);
  return out;
}
