/**
 * What the admin's field-map screens read (listing-model/field-maps R6, ux.md). Read models only; a
 * change is `fieldMapService.save` (ADR-0055).
 */

/** One map of a field, with where it was checked and the answers it has no channel word for. */
export interface AdminFieldMapDTO {
  fieldPath: string;
  /** Blank: every one of our types publishing here; else that type's own row (Q7). */
  bbType: string;
  source: string;
  /** The attribute, rule, product column or shop setting it reads; null for a constant or a developer. */
  key: string | null;
  constant: string | null;
  unitTarget: string | null;
  reason: string;
  checkedSource: string;
  checkedOn: string;
  values: Record<string, string>;
  /** Answers on our list with no pair and no word of the same letters on the channel's (Q10). */
  unpaired: Array<{ optionKey: string; label: string }>;
  /** The channel's closed list for this field, which a pair is chosen from; empty for free text. */
  allowed: string[];
  /** It reads a question the attributes subfeature has not added yet, so it fills nothing today (Q17). */
  waiting: boolean;
}

export interface AdminFieldRowDTO {
  field: string;
  label: string;
  requirement: string;
  adapterFills: boolean;
  /** When a re-read found the channel newly requiring it, inside the last 14 days (ux "Changed by the channel"). */
  addedOn: string | null;
  maps: AdminFieldMapDTO[];
}

/** The choices an edit offers, each with a label for the picker. */
export interface FieldMapChoicesDTO {
  /** Today's questions, and those the attributes subfeature adds (`planned`, Q17). */
  attributes: Array<{ key: string; label: string; planned: boolean }>;
  rules: string[];
  core: string[];
  shop: string[];
}

export interface AdminFieldMapsDTO {
  channel: string;
  channelLabel: string;
  typeKey: string;
  typeLabel: string;
  readAt: string | null;
  rows: AdminFieldRowDTO[];
  choices: FieldMapChoicesDTO;
}

/** A channel type on the channel's admin page, with how much is still unmapped. */
export interface AdminChannelTypeDTO {
  key: string;
  label: string;
  required: number;
  unmapped: number;
}
