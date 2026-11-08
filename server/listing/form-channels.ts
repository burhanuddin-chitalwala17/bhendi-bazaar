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

/** The badge the store's own required questions carry (ux: "Required now holds BB's questions"). */
export const STORE_CHANNEL = "store";

export interface Question {
  kind: "fact" | "measure";
  key: string;
}

/**
 * The form's two groups (dynamic-form R2, ux state matrix): Required now holds the store's own required
 * measurements and what a channel the shop sells on requires; every other question sits under "Also helps
 * on…", with the channels it helps. Pure, so the split is tested apart from the form.
 */
export function groupQuestions(
  facts: readonly FactKey[],
  measures: ReadonlyArray<{ key: MeasureKey; required: boolean }>,
  use: ChannelUseByQuestion,
): { required: Question[]; rest: Question[]; helps: string[]; badges: Record<string, ChannelUse> } {
  const badges: Record<string, ChannelUse> = {};
  const required: Question[] = [];
  const rest: Question[] = [];
  for (const key of facts) {
    const u = use[key];
    if (u) badges[key] = u;
    (u && u.required.length > 0 ? required : rest).push({ kind: "fact", key });
  }
  for (const m of measures) {
    const u = use[m.key] ?? { required: [], helps: [] };
    const own = m.required ? { required: [STORE_CHANNEL, ...u.required], helps: u.helps } : u;
    if (own.required.length + own.helps.length > 0) badges[m.key] = own;
    (own.required.length > 0 ? required : rest).push({ kind: "measure", key: m.key });
  }
  const helps = [...new Set(rest.flatMap((q) => badges[q.key]?.helps ?? []))];
  return { required, rest, helps, badges };
}
