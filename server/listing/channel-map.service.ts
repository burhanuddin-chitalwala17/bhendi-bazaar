import type { Channel } from "@server/shared/channels";
import { categoryRepository } from "@server/catalog/category.read.repository";

import { channelMapRepository } from "./channel-map.repository";
import { FACT_DECLARATIONS } from "./listing-facts";
import { listingValueRepository } from "./listing-value.repository";
import { resolveProductType } from "./product-type";
import { productTypeRepository } from "./product-type.repository";

/**
 * The mapping read backwards, for filling a product from a marketplace listing (marketplace-facts
 * D2): every type row, read ones included, and the attribute and value rows. Readiness and the
 * register read the publishing rows through their own services.
 */
export const channelMapService = {
  async forFill(channel: Channel) {
    const [types, { attributes, values }] = await Promise.all([
      channelMapRepository.typesForFill(channel),
      channelMapRepository.byChannel(channel),
    ]);
    return {
      types: types.map((t) => ({ productType: t.productType, kind: t.kind, theirCategory: t.theirCategory as string })),
      attributes: attributes.map((a) => ({ theirCategory: a.theirCategory, fact: a.fact, theirAttribute: a.theirAttribute, checkedOn: a.checkedOn })),
      values: values.map((v) => ({ list: v.list, valueKey: v.valueKey, theirValue: v.theirValue })),
    };
  },

  /** A type's facts with how each is answered, its measures, our answers to its lists and every type's label. */
  async typeForFill(productType: string, orgId: string) {
    const type = await productTypeRepository.byKey(productType);
    if (!type) return null;
    const facts = type.facts.map((key) => ({
      key,
      label: type.factLabels[key] ?? FACT_DECLARATIONS[key].label,
      answer: FACT_DECLARATIONS[key].answer,
      list: FACT_DECLARATIONS[key].list,
    }));
    const lists = await listingValueRepository.byLists(facts.map((f) => f.list ?? ""), orgId);
    return {
      label: type.label,
      facts,
      measures: type.measures.map((m) => ({ key: m.key, label: m.label, unit: m.unit })),
      lists: Object.fromEntries(Object.entries(lists).map(([list, options]) => [list, options.map((o) => ({ key: o.key, label: o.label }))])),
    };
  },

  /** Every type of ours with the categories whose products take it, for a type or category question (Q11, Q25). */
  async typeChoices(): Promise<Array<{ key: string; label: string; categories: Array<{ id: string; name: string }> }>> {
    const [types, tree, names] = await Promise.all([
      productTypeRepository.options(),
      categoryRepository.listTree(),
      categoryRepository.listForPicker(),
    ]);
    return types.map((type) => ({
      key: type.key,
      label: type.label,
      categories: names.filter((c) => resolveProductType(c.id, tree) === type.key),
    }));
  },
};
