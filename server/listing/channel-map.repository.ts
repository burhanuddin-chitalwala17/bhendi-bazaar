import type { ChannelMapFit, Prisma } from "@prisma/client";

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
  /** Null when `notSold` — a row saying nowhere has no category to name. */
  theirCategory: string | null;
  theirLabel: string | null;
  fit: ChannelMapFit;
  notSold: boolean;
  /** The row this type and kind publishes to; others are only read when filling (marketplace-facts Q18). */
  publishes: boolean;
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
  notSold: true,
  publishes: true,
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

/** A write that may join a caller's transaction (setup-requests D8). */
type Db = Prisma.TransactionClient | typeof prisma;

import { ATTRIBUTE_SOURCE, type AttributeSource } from "./channel-map.types";
export { ATTRIBUTE_SOURCE, type AttributeSource };

export interface AttributeFillRow {
  channel: string;
  theirCategory: string;
  theirAttribute: string;
  source: string | null;
  constant: string | null;
}
const FILL_SELECT = { channel: true, theirCategory: true, theirAttribute: true, source: true, constant: true } as const;

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
      SELECT v."attributeKey" AS fact, v.answer->>'value' AS value, count(*)::int AS products
        FROM "ProductValue" v JOIN "Product" p ON p.id = v."productId"
       WHERE p."archivedAt" IS NULL
         AND NOT v.measured
         AND jsonb_typeof(v.answer) = 'object'
         AND v.answer->>'value' IS NOT NULL
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
    /** Several at once: a listing screen asks about every type it shows, in one read. */
    productTypes: readonly string[];
    lists: readonly string[];
  }): Promise<{
    categories: CategoryMapRow[];
    attributes: AttributeMapRow[];
    values: ValueMapRow[];
  }> {
    const channels = [...new Set(input.channels)];
    const productTypes = [...new Set(input.productTypes.filter(Boolean))];
    if (channels.length === 0 || productTypes.length === 0) {
      return { categories: [], attributes: [], values: [] };
    }
    const lists = [...new Set(input.lists.filter(Boolean))];

    const [categories, values] = await Promise.all([
      // Readiness asks where a product publishes, so only the publishing rows (marketplace-facts D3).
      prisma.channelCategoryMap.findMany({
        where: { channel: { in: channels }, productType: { in: productTypes }, publishes: true },
        select: CATEGORY_SELECT,
      }),
      lists.length === 0
        ? Promise.resolve([])
        : prisma.channelValueMap.findMany({
            where: { channel: { in: channels }, list: { in: lists } },
            select: VALUE_SELECT,
          }),
    ]);

    // Attributes belong to their nodes, so every node these types can reach is read at once —
    // which applies depends on the product's kind, known only later. One query, not one per type.
    const theirCategories = [
      ...new Set(categories.map((row) => row.theirCategory).filter((it): it is string => it !== null)),
    ];
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
  }, db: Db = prisma): Promise<ValueMapRow> {
    const { channel, list, valueKey, theirValue, checkedOn } = input;
    const rest = { theirValue, checkedOn, checkedSource: input.checkedSource ?? null };
    return await db.channelValueMap.upsert({
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
    /** Null together with `notSold`, which is the row that says nowhere. */
    theirCategory: string | null;
    notSold?: boolean;
    theirLabel?: string | null;
    fit: ChannelMapFit;
    note?: string | null;
    checkedOn: Date;
    checkedSource?: string | null;
  }): Promise<CategoryMapRow> {
    const { channel, productType, kind } = input;
    const rest = {
      theirCategory: input.theirCategory,
      notSold: input.notSold ?? false,
      theirLabel: input.theirLabel ?? null,
      fit: input.fit,
      note: input.note ?? null,
      checkedOn: input.checkedOn,
      checkedSource: input.checkedSource ?? null,
    };
    // This sets the publishing row (marketplace-facts D3); rows read only for filling are left. The
    // partial index is the real guard: a concurrent second create fails there.
    const changed = await prisma.channelCategoryMap.updateMany({
      where: { channel, productType, kind, publishes: true },
      data: rest,
    });
    if (changed.count > 0) {
      return await prisma.channelCategoryMap.findFirstOrThrow({
        where: { channel, productType, kind, publishes: true },
        select: CATEGORY_SELECT,
      });
    }
    return await prisma.channelCategoryMap.create({
      data: { channel, productType, kind, publishes: true, ...rest },
      select: CATEGORY_SELECT,
    });
  },

  /** Every type row of a channel, read rows included, for filling a product from a listing (D2). */
  async typesForFill(channel: Channel): Promise<CategoryMapRow[]> {
    return await prisma.channelCategoryMap.findMany({
      where: { channel, theirCategory: { not: null } },
      select: CATEGORY_SELECT,
    });
  },

  /** Add a marketplace type that this type and kind is read from (Q26). Read only until marked. */
  async addReadType(input: {
    channel: Channel;
    productType: string;
    kind: string | null;
    theirCategory: string;
    theirLabel: string | null;
    checkedOn: Date;
    checkedSource: string;
  }, db: Db = prisma): Promise<CategoryMapRow> {
    return await db.channelCategoryMap.create({
      data: {
        channel: input.channel,
        productType: input.productType,
        kind: input.kind,
        theirCategory: input.theirCategory,
        theirLabel: input.theirLabel,
        checkedOn: input.checkedOn,
        checkedSource: input.checkedSource,
        fit: "EXACT",
        notSold: false,
        publishes: false,
      },
      select: CATEGORY_SELECT,
    });
  },

  /** Make one row the publishing one for its type and kind, in one transaction (Q26). */
  async setPublishing(id: string, checkedOn: Date, db?: Prisma.TransactionClient): Promise<CategoryMapRow | null> {
    const run = async (tx: Prisma.TransactionClient) => {
      const row = await tx.channelCategoryMap.findUnique({ where: { id }, select: CATEGORY_SELECT });
      if (!row || row.theirCategory === null) return null;
      await tx.channelCategoryMap.updateMany({
        where: { channel: row.channel, productType: row.productType, kind: row.kind, publishes: true },
        data: { publishes: false },
      });
      return await tx.channelCategoryMap.update({
        where: { id },
        data: { publishes: true, checkedOn },
        select: CATEGORY_SELECT,
      });
    };
    return db ? await run(db) : await prisma.$transaction(run);
  },

  /** Remove a read-only type row (Q26). The publishing row is refused here: mark another first. */
  async removeReadType(id: string): Promise<"removed" | "publishing" | "missing"> {
    // Conditional, so the publishing row cannot be removed however the request races a "Publishes here".
    const result = await prisma.channelCategoryMap.deleteMany({ where: { id, publishes: false } });
    if (result.count === 1) return "removed";
    return (await prisma.channelCategoryMap.count({ where: { id } })) === 0 ? "missing" : "publishing";
  },

  /**
   * Forget a category decision entirely, so the type reads as undecided again.
   *
   * Deleting rather than blanking: an absent row is what "nobody has chosen yet" means, and
   * leaving an empty one behind would be a third state nothing knows how to read.
   */
  async clearCategory(input: {
    channel: Channel;
    productType: string;
    kind: string | null;
  }): Promise<void> {
    // The publishing row only: rows read when filling stay (marketplace-facts D3).
    await prisma.channelCategoryMap.deleteMany({ where: { ...input, publishes: true } });
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
  }, db: Db = prisma): Promise<AttributeMapRow> {
    const { channel, theirCategory, fact } = input;
    const rest = {
      theirAttribute: input.theirAttribute,
      required: input.required,
      freeText: input.freeText ?? false,
      checkedOn: input.checkedOn,
      checkedSource: input.checkedSource ?? null,
    };
    return await db.channelAttributeMap.upsert({
      where: { channel_theirCategory_fact: { channel, theirCategory, fact } },
      create: { channel, theirCategory, fact, ...rest },
      update: rest,
      select: ATTRIBUTE_SELECT,
    });
  },
  /** A fill for an attribute no fact answers: from the product, or one fixed value (setup-requests D6). */
  async setFill(input: { channel: Channel; theirCategory: string; theirAttribute: string; source: AttributeSource | null; constant: string | null; checkedOn: Date; checkedSource: string }, db: Db = prisma): Promise<void> {
    const { channel, theirCategory, theirAttribute } = input;
    const rest = { source: input.source, constant: input.constant, checkedOn: input.checkedOn, checkedSource: input.checkedSource };
    await db.channelAttributeFill.upsert({
      where: { channel_theirCategory_theirAttribute: { channel, theirCategory, theirAttribute } },
      create: { channel, theirCategory, theirAttribute, ...rest },
      update: rest,
    });
  },

  /** The fills for some of a channel's types, in one read. */
  async fillsFor(channel: Channel, theirCategories: readonly string[]): Promise<AttributeFillRow[]> {
    if (theirCategories.length === 0) return [];
    return await prisma.channelAttributeFill.findMany({ where: { channel, theirCategory: { in: [...theirCategories] } }, select: FILL_SELECT });
  },

  /** The fills of some (channel, their category) pairs, in one read (channel-catalogue D5). */
  async fillsForMany(pairs: ReadonlyArray<{ channel: string; key: string }>): Promise<AttributeFillRow[]> {
    if (pairs.length === 0) return [];
    return await prisma.channelAttributeFill.findMany({ where: { OR: pairs.map((p) => ({ channel: p.channel, theirCategory: p.key })) }, select: FILL_SELECT });
  },

  /** Every attribute a channel's type already answers, by a fact or a fill: what is set up (setup-requests D9). */
  async answeredAttributes(channel: Channel, theirCategories: readonly string[]): Promise<Array<{ theirCategory: string; theirAttribute: string; fact: string | null }>> {
    if (theirCategories.length === 0) return [];
    const where = { channel, theirCategory: { in: [...theirCategories] } };
    const [facts, fills] = await Promise.all([
      prisma.channelAttributeMap.findMany({ where, select: { theirCategory: true, theirAttribute: true, fact: true } }),
      prisma.channelAttributeFill.findMany({ where, select: { theirCategory: true, theirAttribute: true } }),
    ]);
    return [
      ...facts.map((r) => ({ theirCategory: r.theirCategory, theirAttribute: r.theirAttribute.split(".")[0], fact: r.fact as string | null })),
      ...fills.map((r) => ({ theirCategory: r.theirCategory, theirAttribute: r.theirAttribute, fact: null })),
    ];
  },

  /** One read row of a type, kind and marketplace type, if added already (setup-requests D8). */
  async typeRow(channel: Channel, productType: string, kind: string | null, theirCategory: string, db: Db = prisma): Promise<CategoryMapRow | null> {
    return await db.channelCategoryMap.findFirst({ where: { channel, productType, kind, theirCategory }, select: CATEGORY_SELECT });
  },

  /** Our types that publish to one of a channel's types: who Apply adds a fact to (setup-requests D6). */
  async typesPublishingTo(channel: Channel, theirCategory: string): Promise<string[]> {
    const rows = await prisma.channelCategoryMap.findMany({ where: { channel, theirCategory, publishes: true }, select: { productType: true }, distinct: ["productType"] });
    return rows.map((r) => r.productType);
  },

  /** The channel types one shop's products publish to, every channel (channel-catalogue D6): products joined to maps in one read. */
  async publishingTypesFor(orgId: string): Promise<Array<{ channel: string; theirCategory: string }>> {
    return await prisma.$queryRaw<Array<{ channel: string; theirCategory: string }>>`
      SELECT DISTINCT m.channel, m."theirCategory"
      FROM "Product" p
      JOIN "ChannelCategoryMap" m ON m."productType" = p."productType" AND m.publishes AND NOT m."notSold" AND m."theirCategory" IS NOT NULL
        AND (m.kind IS NULL OR m.kind = p.kind)
      WHERE p."orgId" = ${orgId} AND p."archivedAt" IS NULL`;
  },

  /** Every channel type some BB type publishes to, on a channel: what the catalogue keeps fresh (channel-catalogue D2). */
  async publishedTypes(channel: Channel): Promise<string[]> {
    const rows = await prisma.channelCategoryMap.findMany({ where: { channel, publishes: true, notSold: false, theirCategory: { not: null } }, select: { theirCategory: true }, distinct: ["theirCategory"] });
    return rows.flatMap((r) => (r.theirCategory ? [r.theirCategory] : []));
  },

  /**
   * The publishing type of each of some types and kinds, for the category check (setup-requests D9). A not-sold
   * row comes back too, with no category, so a kind marked not sold is not read as its type's catch-all.
   */
  async publishingFor(channel: Channel, productTypes: readonly string[]): Promise<Array<{ productType: string; kind: string | null; theirCategory: string | null }>> {
    if (productTypes.length === 0) return [];
    return await prisma.channelCategoryMap.findMany({
      where: { channel, productType: { in: [...productTypes] }, OR: [{ publishes: true }, { notSold: true }] },
      select: { productType: true, kind: true, theirCategory: true },
    });
  },
};
