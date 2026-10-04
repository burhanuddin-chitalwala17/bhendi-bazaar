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
  productType: string;
  fact: string;
  theirAttribute: string;
  required: boolean;
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
  productType: true,
  fact: true,
  theirAttribute: true,
  required: true,
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

export const channelMapRepository = {
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

    const [categories, attributes, values] = await Promise.all([
      prisma.channelCategoryMap.findMany({
        where: { channel: { in: channels }, productType: input.productType },
        select: CATEGORY_SELECT,
      }),
      prisma.channelAttributeMap.findMany({
        where: { channel: { in: channels }, productType: input.productType },
        select: ATTRIBUTE_SELECT,
      }),
      lists.length === 0
        ? Promise.resolve([])
        : prisma.channelValueMap.findMany({
            where: { channel: { in: channels }, list: { in: lists } },
            select: VALUE_SELECT,
          }),
    ]);

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
        orderBy: [{ productType: "asc" }, { fact: "asc" }],
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
    productType: string;
    fact: FactKey;
    theirAttribute: string;
    required: boolean;
    checkedOn: Date;
    checkedSource?: string | null;
  }): Promise<AttributeMapRow> {
    const { channel, productType, fact } = input;
    const rest = {
      theirAttribute: input.theirAttribute,
      required: input.required,
      checkedOn: input.checkedOn,
      checkedSource: input.checkedSource ?? null,
    };
    return await prisma.channelAttributeMap.upsert({
      where: { channel_productType_fact: { channel, productType, fact } },
      create: { channel, productType, fact, ...rest },
      update: rest,
      select: ATTRIBUTE_SELECT,
    });
  },
};
