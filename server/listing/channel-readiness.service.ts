import { CHANNELS, type Channel } from "@server/shared/channels";

import {
  LISTING_PROBLEM,
  LISTING_READINESS,
  enabledChannels,
  keepsItOff,
  readinessByChannel,
  type AttributeMapping,
  type CategoryMapping,
  type ChannelRegister,
  type ListingReadinessReport,
  type ListingSubject,
} from "./channel-readiness";
import { channelMapRepository } from "./channel-map.repository";
import { channelCatalogueRepository } from "./channel-catalogue.repository";
import { FIELD_REQUIREMENT } from "./channel-catalogue.types";
import { orgChannelRepository } from "./org-channel.repository";
import { productReadinessRepository } from "./product-readiness.repository";
import { productTypeRepository } from "./product-type.repository";
import { fillListing } from "./listing-fill.service";
import { FACT_DECLARATIONS, ANSWER, parseStoredFacts, type FactKey } from "./listing-facts";
import type { Answers } from "./fill-facts";
import type { ProductTypeRecord } from "./product-type.types";

/**
 * The gate's caller: it reads, `channel-readiness.ts` decides
 * ([channel-registry](../../docs/specs/channel-registry/) D5).
 *
 * Everything that could be a judgement is in the pure module, so this file has no rules in it —
 * only the four reads a verdict needs and the shape they are assembled into. That division is
 * what lets the hard cases be unit tests rather than a seeded database.
 */

export interface ReadinessSubject {
  /** The product type's key. A product without one cannot be mapped anywhere. */
  productType: string | null;
  kind: string | null;
  /** The product's stored fact tail, as read off the row. */
  facts: unknown;
}

/** One channel's line on the products card: how many would go, and what keeps the rest off (readiness-fix R1). */
export interface ChannelSummaryRow {
  channel: Channel;
  ready: number;
  warned: number;
  incomplete: number;
  /** Products whose type has no category on this channel: the admin's to map, not the shop's. */
  noCategory: number;
  /** Compulsory facts missing, most common first; `fixable` when a picker answers it. */
  gaps: Array<{ fact: FactKey; label: string; count: number; fixable: boolean }>;
}

/** Why a channel would refuse one product: no category there, a compulsory fact unanswered, or an answer it has no word for. */
export type NotReadyReason =
  | { kind: typeof LISTING_PROBLEM.NO_CATEGORY }
  | { kind: typeof LISTING_PROBLEM.MISSING_FACT | typeof LISTING_PROBLEM.UNMAPPED_VALUE; fact: FactKey; label: string }
  | { kind: typeof LISTING_PROBLEM.MISSING_FIELD; label: string };

export interface ChannelVerdict {
  channel: Channel;
  report: ListingReadinessReport;
}

/** The unsaved answers a hint is judged on; the org comes from the caller's scope, never this. */
export interface UnsavedReadinessInput {
  categoryId: string;
  kind?: string | null;
  familyId?: string | null;
  brandId?: string | null;
  facts?: Record<string, string | number | boolean | null | undefined>;
}

async function verdictsOn(channels: Channel[], subject: ReadinessSubject): Promise<ChannelVerdict[]> {
  if (channels.length === 0 || !subject.productType) return [];
  const type = await productTypeRepository.byKey(subject.productType);
  if (!type) return [];
  const registers = (await registersForTypes(channels, [type])).get(type.key)!;
  return readinessByChannel(subjectOf(subject), registers);
}

export const channelReadinessService = {
  /**
   * How every channel this shop sells on would receive this product.
   *
   * Answers an empty list rather than throwing when the shop sells nowhere else or the product
   * has no type: there is nothing to say, and a page asking the question should get silence
   * rather than an error (spec A6).
   */
  async forProduct(orgId: string, subject: ReadinessSubject): Promise<ChannelVerdict[]> {
    return verdictsOn(enabledChannels(await orgChannelRepository.forOrg(orgId)), subject);
  },

  /**
   * The verdict a product would get if saved as it stands in the form (product-form D4, Q8).
   *
   * Filled exactly as a save fills it, so the hint and the later verdict cannot disagree; nothing
   * is written. It advises and never gates (ADR-0053).
   */
  async forUnsaved(orgId: string, input: UnsavedReadinessInput): Promise<ChannelVerdict[]> {
    if (!input.categoryId) return [];
    // A shop selling nowhere else has nothing to be told; checked before the fill's reads.
    const channels = enabledChannels(await orgChannelRepository.forOrg(orgId));
    if (channels.length === 0) return [];
    const filled = await fillListing({
      categoryId: input.categoryId,
      orgId,
      familyId: input.familyId ?? null,
      brandId: input.brandId ?? null,
      facts: input.facts as Answers<FactKey> | undefined,
    });
    return verdictsOn(channels, { productType: filled.productType, kind: input.kind ?? null, facts: filled.facts });
  },

  /**
   * The same verdict for many products of one type, with the register read once.
   *
   * A listing screen asking per product would read the same dictionary once per row, and asking
   * per type would read it once per type. The register is read for every type at once, so a
   * catalogue of nine types costs what one does.
   */
  async forProducts(
    orgId: string,
    subjects: readonly (ReadinessSubject & { id: string })[],
  ): Promise<Map<string, ChannelVerdict[]>> {
    const out = new Map<string, ChannelVerdict[]>();
    const channels = enabledChannels(await orgChannelRepository.forOrg(orgId));
    if (channels.length === 0) return out;

    const byType = new Map<string, (ReadinessSubject & { id: string })[]>();
    for (const subject of subjects) {
      if (!subject.productType) {
        out.set(subject.id, []);
        continue;
      }
      const group = byType.get(subject.productType) ?? [];
      group.push(subject);
      byType.set(subject.productType, group);
    }
    if (byType.size === 0) return out;

    const types = await productTypeRepository.byKeys([...byType.keys()]);
    const registersByType = await registersForTypes(channels, [...types.values()]);

    for (const [key, group] of byType) {
      const registers = registersByType.get(key);
      if (!registers) {
        for (const subject of group) out.set(subject.id, []);
        continue;
      }
      for (const subject of group) {
        out.set(subject.id, readinessByChannel(subjectOf(subject), registers));
      }
    }
    return out;
  },

  /**
   * How many of a shop's products each channel would take as they stand
   * ([channel-registry](../../docs/specs/channel-registry/) R6).
   *
   * A count rather than a column, because the product list pages and refetches on the client:
   * a per-row verdict would be blank on page two unless it travelled through a route handler,
   * and that would be a round trip for a read the server already does. The number answers the
   * question a shop actually has — how much is left — and the product itself says what.
   */
  async summaryForOrg(orgId: string): Promise<ChannelSummaryRow[]> {
    return (await this.readinessOf(orgId)).rows;
  },

  /**
   * The products card's rows and, for one channel and fact, the products missing it, from one
   * computation of the catalogue's verdicts (readiness-fix D1): the card and a fix page agree.
   */
  async readinessOf(orgId: string, missing?: { channel: Channel; fact: FactKey }): Promise<{ rows: ChannelSummaryRow[]; missing: string[] }> {
    const channels = enabledChannels(await orgChannelRepository.forOrg(orgId));
    if (channels.length === 0) return { rows: [], missing: [] };
    const products = await productReadinessRepository.subjectsFor(orgId);
    if (products.length === 0) return { rows: [], missing: [] };
    const verdicts = await this.forProducts(orgId, products);
    return { rows: summarise(channels, verdicts.values()), missing: missing ? missingIn(verdicts, missing.channel, missing.fact) : [] };
  },

  /**
   * The shop's products a channel would refuse as they stand, each with what keeps it off: the
   * products page's channel filter (design-system Q35). The same verdicts the counts come from, so
   * a pill saying "3 to fix" lists exactly three. Empty when the channel is not one the shop uses.
   */
  async notReadyOn(orgId: string, channel: Channel): Promise<Map<string, NotReadyReason[]>> {
    const channels = enabledChannels(await orgChannelRepository.forOrg(orgId));
    if (!channels.includes(channel)) return new Map();
    const products = await productReadinessRepository.subjectsFor(orgId);
    if (products.length === 0) return new Map();
    const verdicts = await this.forProducts(orgId, products);
    const out = new Map<string, NotReadyReason[]>();
    for (const [id, list] of verdicts) {
      const verdict = list.find((v) => v.channel === channel);
      if (verdict?.report.state === LISTING_READINESS.INCOMPLETE) out.set(id, reasonsOf(verdict.report.problems));
    }
    return out;
  },

  /** The shop's products a channel would refuse for want of one fact, for its fix page (readiness-fix R2). */
  async missingFact(orgId: string, channel: Channel, fact: FactKey): Promise<string[]> {
    return (await this.readinessOf(orgId, { channel, fact })).missing;
  },
};

/** Each channel's counts and what keeps products off it (readiness-fix R1): each compulsory fact, or no category. */
function summarise(channels: readonly Channel[], verdicts: Iterable<ChannelVerdict[]>): ChannelSummaryRow[] {
  const tally = new Map(channels.map((channel) => [channel, { channel, ready: 0, warned: 0, incomplete: 0, facts: new Map<FactKey, number>(), noCategory: 0 }]));
  for (const list of verdicts) {
    for (const { channel, report } of list) {
      const row = tally.get(channel);
      if (!row) continue;
      if (report.state === LISTING_READINESS.READY) row.ready += 1;
      else if (report.state === LISTING_READINESS.WARNED) row.warned += 1;
      else row.incomplete += 1;
      for (const problem of report.problems) {
        if (problem.problem === LISTING_PROBLEM.MISSING_FACT) row.facts.set(problem.fact, (row.facts.get(problem.fact) ?? 0) + 1);
        if (problem.problem === LISTING_PROBLEM.NO_CATEGORY) row.noCategory += 1;
      }
    }
  }
  return [...tally.values()].map(({ facts, ...counts }) => ({
    ...counts,
    gaps: [...facts.entries()]
      .map(([fact, count]) => ({ fact, label: FACT_DECLARATIONS[fact]?.label ?? fact, count, fixable: FACT_DECLARATIONS[fact]?.answer === ANSWER.CHOICE }))
      .sort((a, b) => b.count - a.count),
  }));
}

/** The problems that keep it off (`keepsItOff`), worded by their fact where they have one. */
function reasonsOf(problems: ListingReadinessReport["problems"]): NotReadyReason[] {
  return problems.flatMap((p): NotReadyReason[] => {
    if (!keepsItOff(p.problem)) return [];
    if (p.problem === LISTING_PROBLEM.NO_CATEGORY) return [{ kind: LISTING_PROBLEM.NO_CATEGORY }];
    if (p.problem === LISTING_PROBLEM.MISSING_FACT || p.problem === LISTING_PROBLEM.UNMAPPED_VALUE) {
      return [{ kind: p.problem, fact: p.fact, label: FACT_DECLARATIONS[p.fact]?.label ?? p.fact }];
    }
    if (p.problem === LISTING_PROBLEM.MISSING_FIELD) return [{ kind: LISTING_PROBLEM.MISSING_FIELD, label: p.label }];
    return [];
  });
}

function missingIn(verdicts: Map<string, ChannelVerdict[]>, channel: Channel, fact: FactKey): string[] {
  return [...verdicts.entries()]
    .filter(([, list]) => list.some((v) => v.channel === channel && v.report.problems.some((p) => p.problem === LISTING_PROBLEM.MISSING_FACT && p.fact === fact)))
    .map(([id]) => id);
}

const subjectOf = (subject: ReadinessSubject): ListingSubject => ({
  kind: subject.kind,
  facts: parseStoredFacts(subject.facts),
});

/** The value lists this type's facts draw their answers from — the only ones a verdict needs. */
function listsOf(type: ProductTypeRecord): string[] {
  const lists = new Set<string>();
  for (const fact of type.facts) {
    const declaration = FACT_DECLARATIONS[fact];
    if (declaration?.answer === ANSWER.CHOICE && declaration.list) lists.add(declaration.list);
  }
  return [...lists];
}

/**
 * The dictionary for several product types at once, as a register per type per channel.
 *
 * Three queries however many types are asked about: the grouping is in memory, where it costs
 * nothing, rather than in a round trip per type.
 */
async function registersForTypes(
  channels: readonly Channel[],
  types: readonly ProductTypeRecord[],
): Promise<Map<string, Map<Channel, ChannelRegister>>> {
  const out = new Map<string, Map<Channel, ChannelRegister>>();
  if (types.length === 0) return out;

  const { categories, attributes, values } = await channelMapRepository.registersFor({
    channels,
    productTypes: types.map((type) => type.key),
    lists: types.flatMap(listsOf),
  });

  // What each of their categories requires, from the channel's own definition, and what our fill rows
  // already cover: two reads for every type at once (listing-model/channel-catalogue D5).
  const pairs = [...new Map(categories.filter((c) => c.theirCategory).map((c) => [`${c.channel}:${c.theirCategory}`, { channel: c.channel, key: c.theirCategory! }])).values()];
  const [catalogue, fills] = await Promise.all([
    channelCatalogueRepository.fieldsFor(pairs),
    channelMapRepository.fillsForMany(pairs),
  ]);
  const required = new Map<string, { key: string; label: string }[]>();
  for (const [k, fields] of catalogue) required.set(k, fields.filter((f) => f.requirement === FIELD_REQUIREMENT.REQUIRED && !f.adapterFills).map((f) => ({ key: f.key, label: f.label })));
  const filled = new Map<string, Set<string>>();
  for (const f of fills) filled.set(`${f.channel}:${f.theirCategory}`, (filled.get(`${f.channel}:${f.theirCategory}`) ?? new Set()).add(f.theirAttribute));
  const byChannel = <T,>(source: Map<string, T>, channel: string) => new Map([...source].filter(([k]) => k.startsWith(`${channel}:`)).map(([k, v]) => [k.slice(channel.length + 1), v]));

  for (const type of types) {
    const mine = categories.filter((row) => row.productType === type.key);
    const registers = new Map<Channel, ChannelRegister>();

    for (const channel of CHANNELS) {
      if (!channels.includes(channel)) continue;

      const mappedValues = new Map<string, Set<string>>();
      for (const row of values) {
        if (row.channel !== channel) continue;
        const set = mappedValues.get(row.list) ?? new Set<string>();
        set.add(row.valueKey);
        mappedValues.set(row.list, set);
      }

      registers.set(channel, {
        categories: mine.filter((row) => row.channel === channel).map(toCategoryMapping),
        attributesByCategory: groupByCategory(
          attributes.filter((row) => row.channel === channel && isFact(row.fact)),
        ),
        mappedValues,
        requiredByCategory: byChannel(required, channel),
        filledByCategory: byChannel(filled, channel),
      });
    }
    out.set(type.key, registers);
  }
  return out;
}

const toCategoryMapping = (row: {
  kind: string | null;
  theirCategory: string | null;
  fit: CategoryMapping["fit"];
  note: string | null;
  notSold: boolean;
}): CategoryMapping => ({
  kind: row.kind,
  theirCategory: row.theirCategory,
  fit: row.fit,
  note: row.note,
  notSold: row.notSold,
});

/** Their fields, under the node that asks for them. */
function groupByCategory(
  rows: readonly {
    theirCategory: string;
    fact: string;
    theirAttribute: string;
    required: boolean;
    freeText: boolean;
  }[],
): Map<string, AttributeMapping[]> {
  const out = new Map<string, AttributeMapping[]>();
  for (const row of rows) {
    const group = out.get(row.theirCategory) ?? [];
    group.push({
      fact: row.fact as FactKey,
      theirAttribute: row.theirAttribute,
      required: row.required,
      freeText: row.freeText,
    });
    out.set(row.theirCategory, group);
  }
  return out;
}

/** A mapping naming a fact this codebase no longer declares is ignored, never cast through. */
const isFact = (fact: string): fact is FactKey => fact in FACT_DECLARATIONS;
