import { z } from "zod";

import { PUBLISHABLE_CHANNELS, type Channel } from "@server/shared/channels";
import { CORE_KEYS, FIELD_SOURCE, FIELD_SOURCES, PLANNED_ATTRIBUTES, SHOP_KEYS, type FieldSource } from "@server/listing/field-map.types";
import { RULE_KEYS } from "@server/listing/field-rules";
import { FACTS, MEASURES } from "@server/listing/listing-facts";
import { isKnownUnit } from "@server/listing/units";

const QUESTIONS = new Set<string>([...FACTS, ...MEASURES, ...PLANNED_ATTRIBUTES]);
const KEYS_BY_SOURCE: Partial<Record<FieldSource, ReadonlySet<string>>> = {
  [FIELD_SOURCE.ATTRIBUTE]: QUESTIONS,
  [FIELD_SOURCE.RULE]: new Set<string>(RULE_KEYS),
  [FIELD_SOURCE.CORE]: new Set<string>(CORE_KEYS),
  [FIELD_SOURCE.SHOP]: new Set<string>(SHOP_KEYS),
};

/**
 * One map the admin changes (listing-model/field-maps R6, D8): where a channel field's value comes from,
 * and its answers' channel words. The key it reads is checked against what exists, so a map can never
 * name a question, rule or column the builder does not know (D2).
 */
export const fieldMapSaveSchema = z
  .object({
    channel: z.enum(PUBLISHABLE_CHANNELS as unknown as [Channel, ...Channel[]]),
    channelType: z.string().trim().min(1).max(120),
    fieldPath: z.string().trim().min(1).max(200),
    bbType: z.string().trim().max(60),
    source: z.enum(FIELD_SOURCES as unknown as [FieldSource, ...FieldSource[]]),
    key: z.string().trim().max(120).nullable(),
    constant: z.string().trim().max(500).nullable(),
    unitTarget: z.string().trim().max(40).nullable().refine((u) => u === null || u === "" || isKnownUnit(u), "Not a unit we can convert to"),
    reason: z.string().trim().min(1, "Say why").max(300),
    // A pair box left blank is no pair: the admin pairs any of the answers, not all (ux journey 2).
    values: z.preprocess(
      (v) => (v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter(([, w]) => typeof w === "string" && w.trim() !== "")) : v),
      z.record(z.string().trim().min(1).max(80), z.string().trim().min(1).max(200)),
    ),
  })
  .superRefine((v, ctx) => {
    const allowed = KEYS_BY_SOURCE[v.source];
    if (allowed && (!v.key || !allowed.has(v.key))) ctx.addIssue({ code: "custom", path: ["key"], message: "Choose one from the list" });
    if (v.source === FIELD_SOURCE.CONSTANT && !v.constant) ctx.addIssue({ code: "custom", path: ["constant"], message: "Give the fixed value" });
    // A fixed value may name the question whose answer overrides it (spec R4).
    if (v.source === FIELD_SOURCE.CONSTANT && v.key && !QUESTIONS.has(v.key)) ctx.addIssue({ code: "custom", path: ["key"], message: "Choose one from the list" });
  });

export type FieldMapSaveInput = z.output<typeof fieldMapSaveSchema>;

/** One map the admin removes (field-maps Q24): the field reads unmapped again. */
export const fieldMapRemoveSchema = z.object({
  channel: z.enum(PUBLISHABLE_CHANNELS as unknown as [Channel, ...Channel[]]),
  channelType: z.string().trim().min(1).max(120),
  fieldPath: z.string().trim().min(1).max(200),
  bbType: z.string().trim().max(60),
});
export type FieldMapRemoveInput = z.infer<typeof fieldMapRemoveSchema>;
