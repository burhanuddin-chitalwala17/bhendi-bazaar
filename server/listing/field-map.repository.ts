import type { Prisma } from "@prisma/client";

import { prisma } from "@server/shared/prisma";

import type { FieldMapRow } from "./field-map.types";

type Db = Prisma.TransactionClient | typeof prisma;

const SELECT = {
  id: true, channel: true, channelType: true, fieldPath: true, bbType: true, source: true,
  attributeKey: true, ruleKey: true, coreKey: true, shopKey: true, constant: true, unitTarget: true,
  checkedSource: true, checkedOn: true, reason: true,
  values: { select: { optionKey: true, channelValue: true } },
} as const;

export interface FieldMapInput {
  channel: string;
  channelType: string;
  fieldPath: string;
  bbType: string;
  source: string;
  attributeKey: string | null;
  ruleKey: string | null;
  coreKey: string | null;
  shopKey: string | null;
  constant: string | null;
  unitTarget: string | null;
  checkedSource: string;
  checkedOn: Date;
  reason: string;
}

/** How a save treats the pairs a map already holds. */
export const PAIR_MODE = { REPLACE: "replace", MERGE: "merge" } as const;
export type PairMode = (typeof PAIR_MODE)[keyof typeof PAIR_MODE];

/** The one writer of `FieldMap` and `FieldValueMap` (Invariant 5; field-maps D1). */
export const fieldMapRepository = {
  /** Every map of some channel types, with their pairs, in one read (hazard *cost*). */
  async forTypes(pairs: ReadonlyArray<{ channel: string; channelType: string }>, db: Db = prisma): Promise<FieldMapRow[]> {
    if (pairs.length === 0) return [];
    const rows = await db.fieldMap.findMany({
      where: { OR: pairs.map((p) => ({ channel: p.channel, channelType: p.channelType })) },
      select: SELECT,
      orderBy: [{ fieldPath: "asc" }, { bbType: "asc" }],
    });
    return rows.map(({ values, ...row }) => ({ ...row, values: Object.fromEntries(values.map((v) => [v.optionKey, v.channelValue])) }));
  },

  /** One map, its pairs with it (field-maps Q24). False when it was already gone. */
  async remove(key: { channel: string; channelType: string; fieldPath: string; bbType: string }, db: Db = prisma): Promise<boolean> {
    const { count } = await db.fieldMap.deleteMany({ where: key });
    return count > 0;
  },

  /** Every whole-field map on a field in parts, for any type of ours: one answer cannot fill it (Q23). Their pairs go with them. */
  async removeWhole(key: { channel: string; channelType: string; fieldPath: string }, db: Db = prisma): Promise<void> {
    await db.fieldMap.deleteMany({ where: key });
  },

  /**
   * One map and its pairs (spec R6): `replace` makes the given pairs the whole set, as the admin's edit
   * does; `merge` adds them beside the held ones, as a setup request's Apply does.
   */
  async save(input: FieldMapInput, values: Record<string, string>, db: Db = prisma, pairs: PairMode = PAIR_MODE.REPLACE): Promise<{ id: string }> {
    const key = { channel_channelType_fieldPath_bbType: { channel: input.channel, channelType: input.channelType, fieldPath: input.fieldPath, bbType: input.bbType } };
    const row = await db.fieldMap.upsert({ where: key, create: input, update: input, select: { id: true } });
    if (pairs === PAIR_MODE.MERGE) {
      for (const [optionKey, channelValue] of Object.entries(values)) {
        await db.fieldValueMap.upsert({ where: { fieldMapId_optionKey: { fieldMapId: row.id, optionKey } }, create: { fieldMapId: row.id, optionKey, channelValue }, update: { channelValue } });
      }
      return row;
    }
    await db.fieldValueMap.deleteMany({ where: { fieldMapId: row.id } });
    const entries = Object.entries(values);
    if (entries.length > 0) await db.fieldValueMap.createMany({ data: entries.map(([optionKey, channelValue]) => ({ fieldMapId: row.id, optionKey, channelValue })) });
    return row;
  },
};
