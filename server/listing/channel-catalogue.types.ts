/**
 * A channel's own types and fields, as the catalogue stores them (listing-model/channel-catalogue D1).
 * Neutral: the shape every channel's reader returns and readiness reads.
 */

/** How strongly a channel asks a field. */
export const FIELD_REQUIREMENT = { REQUIRED: "required", CONDITIONAL: "conditional", OPTIONAL: "optional" } as const;
export type FieldRequirement = (typeof FIELD_REQUIREMENT)[keyof typeof FIELD_REQUIREMENT];

/** What shape a channel field's value takes. */
export const FIELD_KIND = { CHOICE: "choice", TEXT: "text", NUMBER: "number", MEASURE: "measure", BOOLEAN: "boolean" } as const;
export type FieldKind = (typeof FIELD_KIND)[keyof typeof FIELD_KIND];

/** One field of a channel type as the channel defines it (Q4). */
export interface CatalogueField {
  key: string;
  label: string;
  requirement: FieldRequirement;
  kind: FieldKind;
  allowedValues: string[] | null;
  allowedUnits: string[] | null;
  /** The channel's adapter fills it (identity, offer, compliance plumbing): never asked of the shop (Q5). */
  adapterFills: boolean;
}

/** A channel type with every field it asks, and its JSON Schema where the channel publishes one. */
export interface CatalogueType {
  key: string;
  label: string;
  schema: unknown;
  schemaVersion: string | null;
  fields: CatalogueField[];
}
