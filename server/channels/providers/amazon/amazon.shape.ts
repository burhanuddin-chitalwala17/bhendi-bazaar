import Ajv2019 from "ajv/dist/2019";

import type { BuiltField } from "@server/listing/field-map.types";

import { AMAZON_IN } from "./amazon.listings";

/**
 * Built fields in Amazon's attribute shape, read off the type's own JSON Schema (listing-model/field-maps
 * D5, Q9), and the schema's check before any call (D6).
 */

const LANGUAGE = "en_IN";

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {});

/** A value as the schema types it: Amazon refuses "2" where it asks a number. */
function typed(schema: Json, value: string): unknown {
  const type = schema.type;
  if (type === "number" || type === "integer") {
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  }
  if (type === "boolean") return value === "true" || value.toLowerCase() === "yes";
  return value;
}

/** One leaf object holding exactly the keys its item declares. */
function leaf(props: Json, field: BuiltField): Json {
  const out: Json = {};
  if (props.value) out.value = typed(obj(props.value), field.value);
  if (props.unit && field.unit) out.unit = field.unit;
  if (props.language_tag) out.language_tag = LANGUAGE;
  if (props.marketplace_id) out.marketplace_id = AMAZON_IN;
  return out;
}

/** Without a stored schema: today's text shape, `name` or `name.part` (marketplace-publish D8). */
function plainShape(fields: readonly BuiltField[]): Json {
  const out: Record<string, Json[]> = {};
  for (const f of fields) {
    const [name, part] = f.path.split(".");
    const value = [{ value: f.value, ...(f.unit ? { unit: f.unit } : {}), language_tag: LANGUAGE, marketplace_id: AMAZON_IN }];
    if (!part) {
      out[name] = value;
      continue;
    }
    const item = out[name]?.[0] ?? { marketplace_id: AMAZON_IN };
    item[part] = value;
    out[name] = [item];
  }
  return out;
}

export function amazonAttributes(schema: unknown, fields: readonly BuiltField[]): Json {
  const properties = obj(obj(schema).properties);
  if (Object.keys(properties).length === 0) return plainShape(fields);
  const items = new Map<string, Json>();
  const unknown: BuiltField[] = [];
  for (const field of fields) {
    const [name, part] = field.path.split(".");
    const itemProps = obj(obj(obj(properties[name]).items).properties);
    if (Object.keys(itemProps).length === 0) {
      unknown.push(field);
      continue;
    }
    const item = items.get(name) ?? (itemProps.marketplace_id ? { marketplace_id: AMAZON_IN } : {});
    if (!part) Object.assign(item, leaf(itemProps, field));
    else {
      const sub = obj(itemProps[part]);
      item[part] = sub.type === "array" ? [leaf(obj(obj(sub.items).properties), field)] : sub.type === "object" ? leaf(obj(sub.properties), field) : field.value;
    }
    items.set(name, item);
  }
  return { ...plainShape(unknown), ...Object.fromEntries([...items].map(([name, item]) => [name, [item]])) };
}

/**
 * Each attribute's items keep only the keys their schema declares where it closes the item
 * (`additionalProperties: false`): Amazon's manufacturer contact takes `value` alone, where our text
 * shape adds a language and a marketplace. Without a schema, unchanged.
 */
export function conformToSchema(schema: unknown, attributes: Json): Json {
  const properties = obj(obj(schema).properties);
  if (Object.keys(properties).length === 0) return attributes;
  const out: Json = {};
  for (const [name, value] of Object.entries(attributes)) {
    const items = obj(obj(properties[name]).items);
    const declared = obj(items.properties);
    if (items.additionalProperties !== false || !Array.isArray(value)) {
      out[name] = value;
      continue;
    }
    out[name] = value.map((item) => Object.fromEntries(Object.entries(obj(item)).filter(([k]) => k in declared)));
  }
  return out;
}

/** A problem the schema finds, worded for the shop: the attribute and what it lacks. */
export interface SchemaProblem {
  attribute: string | null;
  message: string;
}

const compiled = new WeakMap<object, ReturnType<Ajv2019["compile"]>>();

/**
 * The attributes checked against the type's schema before Amazon is asked (D6). Amazon's own keywords
 * (`selectors`, `editable`, `enumNames`…) are ignored, as its documentation says a validator may.
 */
export function checkAgainstSchema(schema: unknown, attributes: Json): SchemaProblem[] {
  if (!schema || typeof schema !== "object") return [];
  let validate = compiled.get(schema);
  if (!validate) {
    const ajv = new Ajv2019({ strict: false, allErrors: true, validateFormats: false });
    const { $schema: _meta, $id: _id, ...body } = schema as Json;
    try {
      validate = ajv.compile(body);
    } catch (error) {
      // A schema we cannot read is no reason to refuse: Amazon's own check-only call still decides.
      console.error(`[channels] an Amazon type schema did not compile; skipping the local check: ${error instanceof Error ? error.message.slice(0, 200) : "error"}`);
      return [];
    }
    compiled.set(schema, validate);
  }
  if (validate(attributes)) return [];
  const seen = new Set<string>();
  const out: SchemaProblem[] = [];
  for (const e of validate.errors ?? []) {
    // allOf/if branches repeat one missing attribute many times; the shop needs it once.
    const missing = e.keyword === "required" ? String((e.params as { missingProperty?: string }).missingProperty ?? "") : null;
    const attribute = missing || e.instancePath.split("/")[1] || null;
    if (e.keyword === "if" || e.keyword === "anyOf" || e.keyword === "oneOf" || e.keyword === "allOf") continue;
    const key = `${attribute}:${e.keyword}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const title = attribute ? (obj(obj(obj(schema).properties)[attribute]).title as string | undefined) ?? attribute : "This listing";
    out.push({ attribute, message: missing ? `Amazon needs ${title} for this type.` : `Amazon won't take ${title} as it is (${e.message ?? "not allowed"}).` });
  }
  return out;
}
