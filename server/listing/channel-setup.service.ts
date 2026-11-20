import type { Prisma } from "@prisma/client";

import type { Channel } from "@server/shared/channels";

import { ATTRIBUTE_SOURCE, channelMapRepository, type AttributeSource } from "./channel-map.repository";
import { PAIR_MODE, fieldMapRepository, type FieldMapInput } from "./field-map.repository";
import { ANY_BB_TYPE, FIELD_SOURCE } from "./field-map.types";
import { ANSWER, FACTS, FACT_DECLARATIONS, type FactKey } from "./listing-facts";
import { listingValueRepository } from "./listing-value.repository";
import { productReadinessRepository } from "./product-readiness.repository";
import { productTypeRepository } from "./product-type.repository";
import { labelForFact } from "./product-type.types";

/** A fact as a setup plan sees it: key, the type's label, and the answers its list holds (setup-requests D7). */
export interface SetupFact {
  key: string;
  label: string;
  answers: string[];
  list: string | null;
}

/** One attribute's solution, as Apply writes it (setup-requests D6). */
export type SetupField =
  | { attribute: string; mode: "fact"; fact: FactKey; required: boolean; add: boolean; newAnswers: Array<{ key: string; label: string }> }
  | { attribute: string; mode: "fill"; source: AttributeSource | null; constant: string | null };

const SOURCE = "Applied from a setup request";

/**
 * The same answer as a field map, written beside the old register until retire-old-paths drops it: the
 * create reads field maps (listing-model/field-maps R5), so an Apply must reach them.
 */
function fieldMapOf(channel: Channel, channelType: string, fieldPath: string, now: Date, from: Partial<FieldMapInput> & { source: FieldMapInput["source"] }): FieldMapInput {
  return {
    channel, channelType, fieldPath, bbType: ANY_BB_TYPE, attributeKey: null, ruleKey: null, coreKey: null, shopKey: null,
    constant: null, unitTarget: null, checkedSource: SOURCE, checkedOn: now, reason: "Chosen by the team on a setup request", ...from,
  };
}

/**
 * What a channel's setup is made of, as setup-requests reads and writes it: the vocabulary a plan
 * matches against, what is already set up, and one transaction that writes a plan (D6, D8, D9).
 * Listing's repositories stay behind this surface (ADR-0033).
 */
export const channelSetupService = {
  /** Our types publishing to one marketplace type, each with the facts it asks and every declared fact. */
  async vocabularyFor(channel: Channel, theirCategory: string): Promise<{ types: Array<{ key: string; label: string; asked: SetupFact[] }>; declared: SetupFact[] }> {
    const typeKeys = await channelMapRepository.typesPublishingTo(channel, theirCategory);
    const types = [...(await productTypeRepository.byKeys(typeKeys)).values()];
    const lists = [...new Set(FACTS.map((f) => FACT_DECLARATIONS[f].list).filter((l): l is string => !!l))];
    const values = await listingValueRepository.byLists(lists, null);
    const factOf = (key: FactKey, label?: string): SetupFact => {
      const d = FACT_DECLARATIONS[key];
      return { key, label: label ?? d.label, list: d.list ?? null, answers: d.answer === ANSWER.CHOICE && d.list ? (values[d.list] ?? []).map((v) => v.label) : [] };
    };
    return {
      types: types.map((t) => ({ key: t.key, label: t.label, asked: t.facts.map((f) => factOf(f as FactKey, labelForFact(t, f as FactKey, FACT_DECLARATIONS[f as FactKey].label))) })),
      declared: FACTS.map((f) => factOf(f)),
    };
  },

  /** Attributes of one marketplace type already answered by a fact or a fill. */
  async answered(channel: Channel, theirCategory: string): Promise<Set<string>> {
    return (await this.answeredMany(channel, [theirCategory])).get(theirCategory) ?? new Set();
  },

  /**
   * Answered attributes for many marketplace types at once (the daily check, D9): by the old register, and
   * by a field map, which is what a listing is built from. A map names a path (`inner.material`,
   * `item_dimensions.length`); the attribute it answers is the path's first part.
   */
  async answeredMany(channel: Channel, theirCategories: readonly string[]): Promise<Map<string, Set<string>>> {
    const out = new Map<string, Set<string>>();
    const add = (category: string, attribute: string) => out.set(category, (out.get(category) ?? new Set()).add(attribute));
    const [register, maps] = await Promise.all([
      channelMapRepository.answeredAttributes(channel, theirCategories),
      fieldMapRepository.forTypes(theirCategories.map((channelType) => ({ channel, channelType }))),
    ]);
    for (const row of register) add(row.theirCategory, row.theirAttribute);
    for (const map of maps) add(map.channelType, map.fieldPath.split(".")[0]);
    return out;
  },

  /** Which of our types and kinds publish somewhere on a channel (the category check, D9). */
  async publishing(channel: Channel, productTypes: readonly string[]): Promise<Array<{ productType: string; kind: string | null; theirCategory: string | null }>> {
    return await channelMapRepository.publishingFor(channel, productTypes);
  },

  /** A product's publishing marketplace type, from rows `publishing` already read. */
  publishingOf(rows: ReadonlyArray<{ productType: string; kind: string | null; theirCategory: string | null }>, productType: string | null, kind: string | null): string | null {
    if (!productType) return null;
    const mine = rows.filter((r) => r.productType === productType);
    // A kind's own row first, then the type's row for every kind, as readiness picks (channel-readiness categoryFor);
    // a kind's own not-sold row, which has no category, ends the search there.
    const own = kind !== null ? mine.find((r) => r.kind === kind) : undefined;
    if (own) return own.theirCategory;
    return mine.find((r) => r.kind === null)?.theirCategory ?? null;
  },

  async typeLabel(key: string): Promise<string> {
    return (await productTypeRepository.byKey(key))?.label ?? key;
  },

  /** Products named in complaints, across shops, in one read (D5). */
  async products(ids: readonly string[]) {
    return await productReadinessRepository.byIds(ids);
  },

  /** Each shop's product types in use (the category raise, D5). */
  async typesInUse(orgIds: readonly string[]) {
    return await productReadinessRepository.typesInUse(orgIds);
  },

  /**
   * Write a fields plan in the caller's transaction (D8): facts added to every type publishing to the
   * marketplace type, new answers added to their lists, each attribute mapped to its fact or filled.
   */
  async applyFields(tx: Prisma.TransactionClient, channel: Channel, theirCategory: string, fields: readonly SetupField[], now: Date): Promise<void> {
    const types = await channelMapRepository.typesPublishingTo(channel, theirCategory);
    const added = fields.flatMap((f) => (f.mode === "fact" && f.add ? [f.fact] : []));
    for (const type of types) await productTypeRepository.addFacts(type, added, tx);
    for (const field of fields) {
      if (field.mode === "fill") {
        await channelMapRepository.setFill({ channel, theirCategory, theirAttribute: field.attribute, source: field.source, constant: field.constant, checkedOn: now, checkedSource: SOURCE }, tx);
        await fieldMapRepository.save(fieldMapOf(channel, theirCategory, field.attribute, now, field.constant !== null
          ? { source: FIELD_SOURCE.CONSTANT, constant: field.constant }
          : { source: FIELD_SOURCE.CORE, coreKey: field.source }), {}, tx);
        continue;
      }
      const list = FACT_DECLARATIONS[field.fact].list;
      if (list && field.newAnswers.length > 0) {
        await listingValueRepository.addPlatformValues(list, field.newAnswers, tx);
        for (const answer of field.newAnswers) await channelMapRepository.setValue({ channel, list, valueKey: answer.key, theirValue: answer.label, checkedOn: now, checkedSource: SOURCE }, tx);
      }
      const freeText = FACT_DECLARATIONS[field.fact].answer !== ANSWER.CHOICE;
      await channelMapRepository.setAttribute({ channel, theirCategory, fact: field.fact, theirAttribute: field.attribute, required: field.required, freeText, checkedOn: now, checkedSource: SOURCE }, tx);
      await fieldMapRepository.save(fieldMapOf(channel, theirCategory, field.attribute, now, { source: FIELD_SOURCE.ATTRIBUTE, attributeKey: field.fact }),
        Object.fromEntries(field.newAnswers.map((a) => [a.key, a.label])), tx, PAIR_MODE.MERGE);
    }
  },

  /** Make a marketplace type the one our type publishes to, in the caller's transaction (D8). */
  async applyCategory(tx: Prisma.TransactionClient, channel: Channel, productType: string, theirCategory: string, theirLabel: string, now: Date): Promise<void> {
    const existing = await channelMapRepository.typeRow(channel, productType, null, theirCategory, tx);
    const row = existing ?? (await channelMapRepository.addReadType({ channel, productType, kind: null, theirCategory, theirLabel, checkedOn: now, checkedSource: SOURCE }, tx));
    await channelMapRepository.setPublishing(row.id, now, tx);
  },
};

export { ATTRIBUTE_SOURCE, type AttributeSource };
export const isFactKey = (key: string): key is FactKey => (FACTS as readonly string[]).includes(key);
