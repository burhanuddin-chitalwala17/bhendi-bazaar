import type { ChannelMapFit } from "@prisma/client";

import { prisma } from "@server/shared/prisma";
import type { Channel } from "@server/shared/channels";

import type { FactKey } from "./listing-facts";

/**
 * The one way to reach the three mapping tables
 * ([ADR-0003](../../docs/adr/0003-one-repository-per-aggregate.md)) — what each channel calls the
 * things this shop sells ([channel-registry](../../docs/specs/channel-registry/) D3).
 *
 * One module for the three because they are always read as one thing: a register is a category,
 * its attributes and their values together, and splitting the read across three modules would
 * only mean three callers to keep in step.
 *
 * Reads are always **scoped** — by channel, or by channel and product type. The value table will
 * be the largest of the three by an order of magnitude, and a gate that loaded all of it to
 * check one product would be the N+1's slower cousin.
 */

export interface CategoryMapRow {
  id: string;
  channel: string;
  productType: string;
  kind: string | null;
  theirCategory: string;
  theirLabel: string | null;
  fit: ChannelMapFit;
  note: string | null;
  checkedOn: Date;
  checkedSource: string | null;
}

export interface AttributeMapRow {
  id: string;
  channel: string;
  theirCategory: string;
  fact: string;
  theirAttribute: string;
  required: boolean;
  freeText: boolean;
  checkedOn: Date;
  checkedSource: string | null;
}

export interface ValueMapRow {
  id: string;
  channel: string;
  list: string;
  valueKey: string;
  theirValue: string;
  checkedOn: Date;
  checkedSource: string | null;
}

const CATEGORY_SELECT = {
  id: true,
  channel: true,
  productType: true,
  kind: true,
  theirCategory: true,
  theirLabel: true,
  fit: true,
  note: true,
  checkedOn: true,
  checkedSource: true,
} as const;

const ATTRIBUTE_SELECT = {
  id: true,
  channel: true,
  theirCategory: true,
  fact: true,
  theirAttribute: true,
  required: true,
  freeText: true,
  checkedOn: true,
  checkedSource: true,
} as const;

const VALUE_SELECT = {
  id: true,
  channel: true,
  list: true,
  valueKey: true,
  theirValue: true,
  checkedOn: true,
  checkedSource: true,
} as const;

/** One answer real products give, and how many give it. */
export interface ValueInUse {
  fact: string;
  value: string;
  products: number;
}

export const channelMapRepository = {
  /**
   * Every answer this catalogue actually gives, with how many products give it.
   *
   * The worklist is built from this rather than from the vocabulary, because mapping all 186
   * colours before anybody sells one is work with no buyer. A value arrives on the list when a
   * product answers it, and one mapping clears it for every product that shares it (spec A3).
   *
   * Archived products are excluded: they have left sale, so nothing publishes them and a word
   * only they used is not work.
   */
  async valuesInUse(): Promise<ValueInUse[]> {
    return await prisma.$queryRaw<ValueInUse[]>`
      SELECT f.key AS fact, f.value->>'value' AS value, count(*)::int AS products
        FROM "Product" p, jsonb_each(p.facts) AS f(key, value)
       WHERE p."archivedAt" IS NULL
         AND p.facts IS NOT NULL
         AND jsonb_typeof(f.value) = 'object'
         AND f.value->>'value' IS NOT NULL
       GROUP BY 1, 2
       ORDER BY count(*) DESC, 1, 2`;
  },

  /** The product types and kinds this catalogue actually sells, for the category worklist. */
  async typesInUse(): Promise<{ productType: string; kind: string | null; products: number }[]> {
    return await prisma.$queryRaw`
      SELECT p."productType", p.kind, count(*)::int AS products
        FROM "Product" p
       WHERE p."archivedAt" IS NULL AND p."productType" IS NOT NULL
       GROUP BY 1, 2
       ORDER BY count(*) DESC`;
  },

  /**
   * Everything the given channels say about one product type, in three queries however many
   * channels are asked about.
   *
   * The value lists are asked for by name because the caller knows which the type's facts draw
   * on — reading every value of every channel to answer one product is the read this shape
   * exists to avoid.
   */
  async registersFor(input: {
    channels: readonly Channel[];
    productType: string;
    lists: readonly string[];
  }): Promise<{
    categories: CategoryMapRow[];
    attributes: AttributeMapRow[];
    values: ValueMapRow[];
  }> {
    const channels = [...new Set(input.channels)];
    if (channels.length === 0 || !input.productType) {
      return { categories: [], attributes: [], values: [] };
    }
    const lists = [...new Set(input.lists.filter(Boolean))];

    const [categories, values] = await Promise.all([
      prisma.channelCategoryMap.findMany({
        where: { channel: { in: channels }, productType: input.productType },
        select: CATEGORY_SELECT,
      }),
      lists.length === 0
        ? Promise.resolve([])
        : prisma.channelValueMap.findMany({
            where: { channel: { in: channels }, list: { in: lists } },
            select: VALUE_SELECT,
          }),
    ]);

    // The attributes belong to their nodes, so they are read for the nodes this type can reach
    // — every one of them, because which applies depends on the product's kind. A second round
    // trip rather than a third parallel query, and still one query however many products follow.
    const theirCategories = [...new Set(categories.map((row) => row.theirCategory))];
    const attributes =
      theirCategories.length === 0
        ? []
        : await prisma.channelAttributeMap.findMany({
            where: { channel: { in: channels }, theirCategory: { in: theirCategories } },
            select: ATTRIBUTE_SELECT,
          });

    return { categories, attributes, values };
  },

  /** One channel's whole dictionary, for the admin register. Paged by nothing: it is one screen. */
  async byChannel(channel: Channel): Promise<{
    categories: CategoryMapRow[];
    attributes: AttributeMapRow[];
    values: ValueMapRow[];
  }> {
    const [categories, attributes, values] = await Promise.all([
      prisma.channelCategoryMap.findMany({
        where: { channel },
        orderBy: [{ productType: "asc" }, { kind: "asc" }],
        select: CATEGORY_SELECT,
      }),
      prisma.channelAttributeMap.findMany({
        where: { channel },
        orderBy: [{ theirCategory: "asc" }, { fact: "asc" }],
        select: ATTRIBUTE_SELECT,
      }),
      prisma.channelValueMap.findMany({
        where: { channel },
        orderBy: [{ list: "asc" }, { valueKey: "asc" }],
        select: VALUE_SELECT,
      }),
    ]);
    return { categories, attributes, values };
  },

  /**
   * Record what a channel calls one of our values.
   *
   * Upsert on the natural key, because adding the mapping that is already there is the shop
   * correcting a word rather than an error to show it.
   */
  async setValue(input: {
    channel: Channel;
    list: string;
    valueKey: string;
    theirValue: string;
    checkedOn: Date;
    checkedSource?: string | null;
  }): Promise<ValueMapRow> {
    const { channel, list, valueKey, theirValue, checkedOn } = input;
    const rest = { theirValue, checkedOn, checkedSource: input.checkedSource ?? null };
    return await prisma.channelValueMap.upsert({
      where: { channel_list_valueKey: { channel, list, valueKey } },
      create: { channel, list, valueKey, ...rest },
      update: rest,
      select: VALUE_SELECT,
    });
  },

  async setCategory(input: {
    channel: Channel;
    productType: string;
    kind: string | null;
    theirCategory: string;
    theirLabel?: string | null;
    fit: ChannelMapFit;
    note?: string | null;
    checkedOn: Date;
    checkedSource?: string | null;
  }): Promise<CategoryMapRow> {
    const { channel, productType, kind } = input;
    const rest = {
      theirCategory: input.theirCategory,
      theirLabel: input.theirLabel ?? null,
      fit: input.fit,
      note: input.note ?? null,
      checkedOn: input.checkedOn,
      checkedSource: input.checkedSource ?? null,
    };
    // Prisma's compound-unique input will not take a null `kind`, because a unique index does
    // not constrain NULLs — so the catch-all mapping cannot go through `upsert` and is matched
    // by hand. The partial index is what actually keeps it single: a concurrent second create
    // fails there rather than quietly becoming a second answer.
    if (kind === null) {
      const changed = await prisma.channelCategoryMap.updateMany({
        where: { channel, productType, kind: null },
        data: rest,
      });
      if (changed.count > 0) {
        return await prisma.channelCategoryMap.findFirstOrThrow({
          where: { channel, productType, kind: null },
          select: CATEGORY_SELECT,
        });
      }
      return await prisma.channelCategoryMap.create({
        data: { channel, productType, kind: null, ...rest },
        select: CATEGORY_SELECT,
      });
    }

    return await prisma.channelCategoryMap.upsert({
      where: { channel_productType_kind: { channel, productType, kind } },
      create: { channel, productType, kind, ...rest },
      update: rest,
      select: CATEGORY_SELECT,
    });
  },

  async setAttribute(input: {
    channel: Channel;
    theirCategory: string;
    fact: FactKey;
    theirAttribute: string;
    required: boolean;
    freeText?: boolean;
    checkedOn: Date;
    checkedSource?: string | null;
  }): Promise<AttributeMapRow> {
    const { channel, theirCategory, fact } = input;
    const rest = {
      theirAttribute: input.theirAttribute,
      required: input.required,
      freeText: input.freeText ?? false,
      checkedOn: input.checkedOn,
      checkedSource: input.checkedSource ?? null,
    };
    return await prisma.channelAttributeMap.upsert({
      where: { channel_theirCategory_fact: { channel, theirCategory, fact } },
      create: { channel, theirCategory, fact, ...rest },
      update: rest,
      select: ATTRIBUTE_SELECT,
    });
  },
};
