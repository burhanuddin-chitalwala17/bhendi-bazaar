/** The admin's field-map screens (listing-model/field-maps ux.md copy deck; ADR-0067). */
import { FIELD_SOURCE, type FieldSource } from "@server/listing/field-map.types";

import { formatDate } from "@/lib/format";

const date = (iso: string) => formatDate(iso, { day: "numeric", month: "short", year: "numeric" });

/** Each rule in words (ux copy deck: "Rule: from Audience"). */
export const RULE_LABELS: Record<string, string> = {
  department_from_audience: "department from Audience", age_range_from_audience: "age range from Audience",
  gender_from_audience: "gender from Audience", age_group_from_audience: "age group from Audience",
  size_label: "the size label, else Free Size", size_display_from_measures: "size in words from the measurements",
};
/** Each product field in words (ux copy deck: "Name"). */
export const CORE_LABELS: Record<string, string> = {
  name: "Name", sku: "SKU", description: "Description", brand: "Brand", weight: "Weight", barcode: "Barcode", kind: "Kind",
};

export const FIELD_MAP_COPY = {
  typesTitle: "How each field is filled",
  typesBody: "Every channel type we publish to, with what it asks. Tap one to see where each field's value comes from.",
  typesLabel: "Channel types",
  typeColumn: "Type",
  requiredColumn: "Required",
  unmappedColumn: "Not mapped",
  noTypes: "No types yet",
  noTypesBody: "This channel's types haven't been read yet. Amazon is read once a day; the others ship with each release.",
  required: (n: number) => `${n} required`,
  unmapped: (n: number) => (n > 0 ? `${n} not mapped` : "All mapped"),
  description: (channel: string, readAt: string | null) =>
    readAt ? `What ${channel} asks for this type, read ${date(readAt)}, and where each value comes from.` : `Where each value comes from on ${channel}.`,
  search: "Search fields",
  noMatch: "No field matches that.",
  requirement: { required: "Required", conditional: "Conditional", optional: "Optional" } as Record<string, string>,
  sourceLine: (source: string, key: string | null, constant: string | null, label: (k: string) => string): string => {
    switch (source as FieldSource) {
      case FIELD_SOURCE.ATTRIBUTE: return `From product: ${key ? label(key) : "—"}`;
      case FIELD_SOURCE.RULE: return `Rule: ${key ? (RULE_LABELS[key] ?? key) : "—"}`;
      case FIELD_SOURCE.CONSTANT: return `Fixed: ${constant ?? "—"}`;
      case FIELD_SOURCE.CORE: return key ? (CORE_LABELS[key] ?? key) : "—";
      case FIELD_SOURCE.SHOP: return `Shop setting: ${key ?? "—"}`;
      case FIELD_SOURCE.DEVELOPER: return "Needs a developer · requested";
      default: return source;
    }
  },
  part: (path: string) => `Part: ${path}`,
  inParts: (parts: readonly string[]) => `In parts: ${parts.join(", ")}`,
  partOf: (field: string, part: string) => `${field} · ${part}`,
  mapPart: (part: string) => `Map ${part}`,
  wholeOnParts: "Can't fill a field in parts. Map each part instead.",
  forType: (bbType: string) => `Only for our type ${bbType}`,
  unit: (u: string) => `in ${u}`,
  filledBySystem: "Filled by the system",
  waiting: "Waiting on a new question; fills nothing yet",
  planned: (label: string) => `${label} (coming)`,
  noPair: "No match",
  notMapped: "Not mapped",
  addedOn: (iso: string) => `New · added ${date(iso)}`,
  unpaired: (n: number, channel: string) => `${n} ${n === 1 ? "answer has" : "answers have"} no ${channel} match`,
  pairThem: "Pair them",
  checked: (source: string, iso: string) => `Checked against ${source}, ${date(iso)}`,
  change: "Change",
  map: "Map it",
  cancel: "Cancel",
  save: "Save",
  saved: (type: string) => `Saved. Every ${type} uses it from now on.`,
  saveFailed: "Couldn't save that. Nothing was changed.",
  fields: {
    source: "Where the value comes from",
    key: "Which one",
    constant: "Fixed value",
    unit: "Send in unit (optional)",
    reason: "Why",
    pair: (label: string) => `What ${label} is called on the channel`,
  },
  sources: {
    [FIELD_SOURCE.ATTRIBUTE]: "A product question",
    [FIELD_SOURCE.RULE]: "A rule",
    [FIELD_SOURCE.CORE]: "A product field",
    [FIELD_SOURCE.SHOP]: "A shop setting",
    [FIELD_SOURCE.CONSTANT]: "A fixed value",
    [FIELD_SOURCE.DEVELOPER]: "Needs a developer",
  } as Record<FieldSource, string>,
  pick: "Choose…",
} as const;
