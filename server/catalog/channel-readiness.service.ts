import { CHANNELS, type Channel } from "@server/shared/channels";

import {
  LISTING_READINESS,
  enabledChannels,
  readinessByChannel,
  type AttributeMapping,
  type CategoryMapping,
  type ChannelRegister,
  type ListingReadinessReport,
  type ListingSubject,
} from "./channel-readiness";
import { channelMapRepository } from "./channel-map.repository";
import { orgChannelRepository } from "./org-channel.repository";
import { productReadinessRepository } from "./product-readiness.repository";
import { productTypeRepository } from "./product-type.repository";
import { FACT_DECLARATIONS, ANSWER, parseStoredFacts, type FactKey } from "./listing-facts";
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

export interface ChannelVerdict {
  channel: Channel;
  report: ListingReadinessReport;
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
    const channels = enabledChannels(await orgChannelRepository.forOrg(orgId));
    if (channels.length === 0 || !subject.productType) return [];

    const type = await productTypeRepository.byKey(subject.productType);
    if (!type) return [];

    const registers = (await registersForTypes(channels, [type])).get(type.key)!;
    return readinessByChannel(subjectOf(subject), registers);
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
  async summaryForOrg(
    orgId: string,
  ): Promise<{ channel: Channel; ready: number; warned: number; incomplete: number }[]> {
    const channels = enabledChannels(await orgChannelRepository.forOrg(orgId));
    if (channels.length === 0) return [];

    const products = await productReadinessRepository.subjectsFor(orgId);
    if (products.length === 0) return [];

    const verdicts = await this.forProducts(orgId, products);
    const tally = new Map(
      channels.map((channel) => [channel, { channel, ready: 0, warned: 0, incomplete: 0 }]),
    );
    for (const list of verdicts.values()) {
      for (const { channel, report } of list) {
        const row = tally.get(channel);
        if (!row) continue;
        if (report.state === LISTING_READINESS.READY) row.ready += 1;
        else if (report.state === LISTING_READINESS.WARNED) row.warned += 1;
        else row.incomplete += 1;
      }
    }
    return [...tally.values()];
  },
};

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
