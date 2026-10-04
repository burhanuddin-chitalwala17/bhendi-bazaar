import { CHANNEL_LABELS, PUBLISHABLE_CHANNELS, type Channel } from "@server/shared/channels";

import { channelMapRepository } from "./channel-map.repository";
import { productTypeRepository } from "./product-type.repository";
import { listingValueRepository } from "./listing-value.repository";
import { categoryFor } from "./channel-readiness";
import { ANSWER, FACT_DECLARATIONS, type FactKey } from "./listing-facts";

/**
 * The platform owner's view of one channel's dictionary, and what is still missing from it
 * ([channel-registry](../../docs/specs/channel-registry/) R8, spec A3, fourth hazard).
 *
 * Both worklists are built from **what this catalogue actually sells**, never from the whole
 * vocabulary. Mapping all 186 colours before anybody sells one is work with no buyer, and a
 * worklist that never shortens is one nobody finishes. A value arrives when a product answers
 * it, and one mapping clears it for every product that shares it.
 */

export interface UnmappedValue {
  list: string;
  valueKey: string;
  /** How this shop words it, so the owner is choosing against a label rather than a key. */
  label: string;
  /** The facts that reach this value, for an owner deciding what it means. */
  facts: FactKey[];
  products: number;
}

export interface UnmappedCategory {
  productType: string;
  typeLabel: string;
  kind: string | null;
  products: number;
}

/** A type the owner has decided does not sell on this channel — a decision, not a gap. */
export interface NotSoldHere {
  productType: string;
  typeLabel: string;
  kind: string | null;
  products: number;
}

export interface ChannelRegisterView {
  channel: Channel;
  label: string;
  counts: { categories: number; attributes: number; values: number };
  notSold: NotSoldHere[];
  /** Category mappings that are the nearest they have rather than their own word (D6). */
  nearestFits: {
    productType: string;
    kind: string | null;
    theirCategory: string | null;
    note: string | null;
  }[];
  unmappedValues: UnmappedValue[];
  unmappedCategories: UnmappedCategory[];
}

export const channelRegisterService = {
  /** What is mapped for a channel, and what this catalogue still needs mapped. */
  async view(channel: Channel): Promise<ChannelRegisterView> {
    const [maps, valuesInUse, typesInUse, types] = await Promise.all([
      channelMapRepository.byChannel(channel),
      channelMapRepository.valuesInUse(),
      channelMapRepository.typesInUse(),
      productTypeRepository.list(),
    ]);

    const typeLabels = new Map(types.map((type) => [type.key, type.label]));

    // A list only needs mapping where this channel asks a fact that draws on it, and only where
    // it keeps a vocabulary of its own: a free-text field takes any answer, so nothing is missing.
    const listsNeedingWords = new Set<string>();
    for (const attribute of maps.attributes) {
      if (attribute.freeText) continue;
      const list = listOf(attribute.fact);
      if (list) listsNeedingWords.add(list);
    }

    const mapped = new Set(maps.values.map((row) => `${row.list}\u0000${row.valueKey}`));
    const byValue = new Map<string, UnmappedValue>();
    for (const used of valuesInUse) {
      const list = listOf(used.fact);
      if (!list || !listsNeedingWords.has(list)) continue;
      if (mapped.has(`${list}\u0000${used.value}`)) continue;

      const id = `${list}\u0000${used.value}`;
      const entry = byValue.get(id) ?? {
        list,
        valueKey: used.value,
        label: used.value,
        facts: [],
        products: 0,
      };
      if (!entry.facts.includes(used.fact as FactKey)) entry.facts.push(used.fact as FactKey);
      // Two facts on one product reaching the same value is one product to fix, but they arrive
      // as separate rows, so the larger count is the honest one rather than their sum.
      entry.products = Math.max(entry.products, used.products);
      byValue.set(id, entry);
    }

    await labelThem([...byValue.values()]);

    const unmappedCategories: UnmappedCategory[] = [];
    const notSold: NotSoldHere[] = [];
    for (const inUse of typesInUse) {
      const rows = maps.categories.filter((row) => row.productType === inUse.productType);
      const resolved = categoryFor(rows, inUse.kind);
      // A decision already taken is not work. It is listed separately so it stays findable and
      // reversible — hiding it would trade one problem for a worse one.
      if (resolved?.notSold) {
        notSold.push({
          productType: inUse.productType,
          typeLabel: typeLabels.get(inUse.productType) ?? inUse.productType,
          kind: inUse.kind,
          products: inUse.products,
        });
        continue;
      }
      if (resolved !== null) continue;
      unmappedCategories.push({
        productType: inUse.productType,
        typeLabel: typeLabels.get(inUse.productType) ?? inUse.productType,
        kind: inUse.kind,
        products: inUse.products,
      });
    }

    return {
      channel,
      label: CHANNEL_LABELS[channel],
      counts: {
        categories: maps.categories.length,
        attributes: maps.attributes.length,
        values: maps.values.length,
      },
      notSold: notSold.sort((a, b) => b.products - a.products),
      nearestFits: maps.categories
        .filter((row) => row.fit === "NEAREST" && !row.notSold)
        .map((row) => ({
          productType: row.productType,
          kind: row.kind,
          theirCategory: row.theirLabel ?? row.theirCategory,
          note: row.note,
        })),
      unmappedValues: [...byValue.values()].sort(
        (a, b) => b.products - a.products || a.list.localeCompare(b.list),
      ),
      unmappedCategories: unmappedCategories.sort((a, b) => b.products - a.products),
    };
  },

  /** Every channel, with how much of each is still to do — the register's front page. */
  async summary(): Promise<{ channel: Channel; label: string; toDo: number; mapped: number }[]> {
    const views = await Promise.all(PUBLISHABLE_CHANNELS.map((channel) => this.view(channel)));
    return views.map((view) => ({
      channel: view.channel,
      label: view.label,
      toDo: view.unmappedValues.length + view.unmappedCategories.length,
      mapped: view.counts.categories + view.counts.attributes + view.counts.values,
    }));
  },
};

/** Show the shop's own word for a value, not the key it is stored under. */
async function labelThem(entries: UnmappedValue[]): Promise<void> {
  const lists = [...new Set(entries.map((entry) => entry.list))];
  if (lists.length === 0) return;
  const byList = await listingValueRepository.byLists(lists, null);
  for (const entry of entries) {
    const hit = byList[entry.list]?.find((option) => option.key === entry.valueKey);
    if (hit) entry.label = hit.label;
  }
}

/** The list a fact draws on, or null where its answer is free. */
function listOf(fact: string): string | null {
  const declaration = FACT_DECLARATIONS[fact as FactKey];
  if (!declaration || declaration.answer !== ANSWER.CHOICE) return null;
  return declaration.list ?? null;
}
