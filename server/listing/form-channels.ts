import { FIELD_REQUIREMENT } from "./channel-catalogue.types";
import type { CatalogueFieldRow } from "./channel-catalogue.repository";
import { FIELD_SOURCE, fieldsOf, type FieldMapRow } from "./field-map.types";
import type { RuleKey } from "./field-rules";
import { FACT, type FactKey, type MeasureKey } from "./listing-facts";

/**
 * Which of a shop's channels need each question of a type (listing-model/dynamic-form R2, D1): "required"
 * where a channel the shop sells on requires the field a question fills, "helps" where any other channel,
 * or a connected one's optional field, uses it. Pure; the loader reads every input once.
 */

export interface ChannelUse {
  required: string[];
  helps: string[];
}
export type ChannelUseByQuestion = Record<string, ChannelUse>;
/** Per kind of the type, "*" for a kind with no channel type of its own (dynamic-form Q7). */
export type ChannelUseByKind = Record<string, ChannelUseByQuestion>;
export const ANY_KIND = "*";

/** The question a rule reads, so a channel field filled by a rule badges that question. */
const RULE_READS: Partial<Record<RuleKey, FactKey>> = {
  department_from_audience: FACT.AUDIENCE,
  age_range_from_audience: FACT.AUDIENCE,
  gender_from_audience: FACT.AUDIENCE,
  age_group_from_audience: FACT.AUDIENCE,
};

export interface TypeChannel {
  channel: string;
  /** The channel's types our type publishes to, each with its live fields. */
  fields: readonly CatalogueFieldRow[];
  maps: readonly FieldMapRow[];
}

export function channelUseFor(bbType: string, channels: readonly TypeChannel[], enabled: ReadonlySet<string>): ChannelUseByQuestion {
  const out: ChannelUseByQuestion = {};
  const mark = (question: string, channel: string, required: boolean) => {
    const use = (out[question] ??= { required: [], helps: [] });
    if (required && !use.required.includes(channel)) {
      use.required.push(channel);
      use.helps = use.helps.filter((c) => c !== channel);
    } else if (!required && !use.required.includes(channel) && !use.helps.includes(channel)) use.helps.push(channel);
  };
  for (const { channel, fields, maps } of channels) {
    const requirement = new Map(fields.map((f) => [f.key, f.requirement]));
    for (const m of maps) {
      if (m.bbType && m.bbType !== bbType) continue;
      const question = m.source === FIELD_SOURCE.RULE ? (m.ruleKey ? RULE_READS[m.ruleKey as RuleKey] : undefined) : m.attributeKey ?? undefined;
      if (!question) continue;
      const field = fieldsOf(m.fieldPath).find((k) => requirement.has(k));
      // A fixed value only defaults the question, so it never makes the question required.
      const required = m.source !== FIELD_SOURCE.CONSTANT && enabled.has(channel) && !!field && requirement.get(field) === FIELD_REQUIREMENT.REQUIRED;
      mark(question, channel, required);
    }
  }
  return out;
}

/** The badge the store's own required questions carry. */
export const STORE_CHANNEL = "store";

export interface Question {
  kind: "fact" | "measure";
  key: string;
}

/** What the form's filter chips pick: every question, the store's own required ones, or one channel's. */
export const FIELD_FILTER = { ALL: "all", REQUIRED: "required" } as const;
export type FieldFilter = (typeof FIELD_FILTER)[keyof typeof FIELD_FILTER] | string;

export interface FilterChip {
  key: FieldFilter;
  /** Questions under this chip; a chip with none is not offered. */
  questions: Question[];
}

/**
 * Every question, in one open list, with chips that narrow it (listing-model Q35): All, Required
 * (what bhendi-bazaar.com itself needs) and one per marketplace that asks something of this type.
 * The required marker is the store's alone; a channel's own needs show only under its chip. Pure.
 */
export function filterQuestions(
  facts: readonly FactKey[],
  measures: ReadonlyArray<{ key: MeasureKey; required: boolean }>,
  use: ChannelUseByQuestion,
  channels: readonly string[],
): { storeRequired: Set<string>; chips: FilterChip[]; badges: Record<string, ChannelUse> } {
  const all: Question[] = [...facts.map((key) => ({ kind: "fact" as const, key })), ...measures.map((m) => ({ kind: "measure" as const, key: m.key }))];
  const storeRequired = new Set(measures.filter((m) => m.required).map((m) => m.key as string));
  const badges: Record<string, ChannelUse> = {};
  for (const q of all) {
    const u = use[q.key];
    const required = storeRequired.has(q.key) ? [STORE_CHANNEL] : [];
    const asks = [...new Set([...(u?.required ?? []), ...(u?.helps ?? [])])];
    if (required.length + asks.length > 0) badges[q.key] = { required, helps: asks };
  }
  const asked = (channel: string) => all.filter((q) => badges[q.key]?.helps.includes(channel));
  const chips: FilterChip[] = [
    { key: FIELD_FILTER.ALL, questions: all },
    { key: FIELD_FILTER.REQUIRED, questions: all.filter((q) => storeRequired.has(q.key)) },
    ...channels.map((c) => ({ key: c, questions: asked(c) })),
  ].filter((chip) => chip.key === FIELD_FILTER.ALL || chip.questions.length > 0);
  return { storeRequired, chips, badges };
}
