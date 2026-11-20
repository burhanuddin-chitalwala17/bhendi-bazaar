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

/**
 * Amazon's code for a display name, where its list names its values (`Not Water Resistant` →
 * `not_water_resistant`): the catalogue and pairing speak names, the API takes the code (proof run).
 */
function codeFor(schema: Json, value: string): string {
  const lists = [schema, ...(Array.isArray(schema.anyOf) ? (schema.anyOf as unknown[]).map(obj) : [])];
  for (const l of lists) {
    const codes = Array.isArray(l.enum) ? (l.enum as unknown[]).map(String) : [];
    const names = Array.isArray(l.enumNames) ? (l.enumNames as unknown[]).map(String) : [];
    if (codes.length === 0 || codes.length !== names.length) continue;
    const at = names.findIndex((n) => n.trim().toLowerCase() === value.trim().toLowerCase());
    if (at >= 0) return codes[at];
  }
  return value;
}

/** A value as the schema types it: Amazon refuses "2" where it asks a number. */
function typed(schema: Json, value: string): unknown {
  const type = schema.type;
  if (type === "number" || type === "integer") {
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  }
  if (type === "boolean") return value === "true" || value.toLowerCase() === "yes";
  return codeFor(schema, value);
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
    // A measure is a number with its unit and no language; a part of one is a bare object (item_dimensions.height).
    const measure = f.unit !== undefined && Number.isFinite(Number(f.value));
    if (!part) {
      out[name] = [measure ? { value: Number(f.value), unit: f.unit, marketplace_id: AMAZON_IN } : { value: f.value, language_tag: LANGUAGE, marketplace_id: AMAZON_IN }];
      continue;
    }
    const item = out[name]?.[0] ?? { marketplace_id: AMAZON_IN };
    item[part] = measure ? { value: Number(f.value), unit: f.unit } : [{ value: f.value, language_tag: LANGUAGE }];
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
  // A closed type refuses the whole listing for one attribute it does not have (a home type has no HSN line).
  const closed = obj(schema).additionalProperties === false;
  const out: Json = {};
  for (const [name, value] of Object.entries(attributes)) {
    if (closed && !(name in properties)) continue;
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
  /** A field the schema's rules would require. JSON Schema reads Amazon's conditions more strictly than Amazon does, so this never blocks a send (proof run). */
  missing: boolean;
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
    const extra = e.keyword === "additionalProperties" && e.instancePath === "" ? String((e.params as { additionalProperty?: string }).additionalProperty ?? "") : null;
    const attribute = missing || extra || e.instancePath.split("/")[1] || null;
    if (e.keyword === "if" || e.keyword === "anyOf" || e.keyword === "oneOf" || e.keyword === "allOf") continue;
    const key = `${attribute}:${e.keyword}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const title = attribute ? (obj(obj(obj(schema).properties)[attribute]).title as string | undefined) ?? attribute : "This listing";
    const message = missing ? `Amazon needs ${title} for this type.` : extra ? `Amazon has no ${extra} for this type.` : `Amazon won't take ${title} as it is (${e.message ?? "not allowed"}).`;
    out.push({ attribute, missing: !!missing, message });
  }
  return out;
}
