import { CHANNELS, type Channel } from "@server/shared/channels";

import {
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

    const registers = await registersFor(channels, type);
    return readinessByChannel(subjectOf(subject), registers);
  },

  /**
   * The same verdict for many products of one type, with the register read once.
   *
   * A listing screen asking per product would read the same dictionary once per row. The type is
   * the unit the register is keyed by, so the products are grouped by it and each group costs
   * the same three queries one product would.
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

    for (const [key, group] of byType) {
      const type = types.get(key);
      if (!type) {
        for (const subject of group) out.set(subject.id, []);
        continue;
      }
      const registers = await registersFor(channels, type);
      for (const subject of group) {
        out.set(subject.id, readinessByChannel(subjectOf(subject), registers));
      }
    }
    return out;
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

/** One channel's half of the dictionary, per channel, from one read of the three tables. */
async function registersFor(
  channels: readonly Channel[],
  type: ProductTypeRecord,
): Promise<Map<Channel, ChannelRegister>> {
  const { categories, attributes, values } = await channelMapRepository.registersFor({
    channels,
    productType: type.key,
    lists: listsOf(type),
  });

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
      categories: categories.filter((row) => row.channel === channel).map(toCategoryMapping),
      attributes: attributes
        .filter((row) => row.channel === channel && isFact(row.fact))
        .map(toAttributeMapping),
      mappedValues,
    });
  }
  return registers;
}

const toCategoryMapping = (row: {
  kind: string | null;
  theirCategory: string;
  fit: CategoryMapping["fit"];
  note: string | null;
}): CategoryMapping => ({
  kind: row.kind,
  theirCategory: row.theirCategory,
  fit: row.fit,
  note: row.note,
});

const toAttributeMapping = (row: {
  fact: string;
  theirAttribute: string;
  required: boolean;
}): AttributeMapping => ({
  fact: row.fact as FactKey,
  theirAttribute: row.theirAttribute,
  required: row.required,
});

/** A mapping naming a fact this codebase no longer declares is ignored, never cast through. */
const isFact = (fact: string): fact is FactKey => fact in FACT_DECLARATIONS;
