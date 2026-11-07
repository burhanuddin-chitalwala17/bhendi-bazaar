import { Prisma } from "@prisma/client";

import { prisma } from "@server/shared/prisma";

import type { CatalogueType } from "./channel-catalogue.types";

/** A stored channel field, as readiness reads it (listing-model/channel-catalogue D1). */
export interface CatalogueFieldRow {
  key: string;
  label: string;
  requirement: string;
  kind: string;
  allowedValues: unknown;
  allowedUnits: unknown;
  adapterFills: boolean;
}

const FIELD_SELECT = { key: true, label: true, requirement: true, kind: true, allowedValues: true, allowedUnits: true, adapterFills: true } as const;
const json = (v: unknown) => (v === null || v === undefined ? Prisma.DbNull : (v as Prisma.InputJsonValue));

/** The one writer of `ChannelType` and `ChannelField` (Invariant 5). */
export const channelCatalogueRepository = {
  /**
   * One type and every field it asks, upserted by key, in one transaction; a field the channel no
   * longer lists is marked gone, never deleted (D2). Answers the keys of required fields that are new.
   */
  async upsertType(channel: string, type: CatalogueType, source: string, now: Date): Promise<string[]> {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.channelType.upsert({
        where: { channel_key: { channel, key: type.key } },
        create: { channel, key: type.key, label: type.label, schema: json(type.schema), schemaVersion: type.schemaVersion, source, readAt: now },
        update: { label: type.label, schema: json(type.schema), schemaVersion: type.schemaVersion, source, readAt: now, goneAt: null },
        select: { id: true },
      });
      const before = await tx.channelField.findMany({ where: { channelTypeId: row.id, goneAt: null }, select: { key: true, requirement: true } });
      const wasRequired = new Set(before.filter((f) => f.requirement === "required").map((f) => f.key));
      for (const f of type.fields) {
        const data = { label: f.label, requirement: f.requirement, kind: f.kind, allowedValues: json(f.allowedValues), allowedUnits: json(f.allowedUnits), adapterFills: f.adapterFills, readAt: now, goneAt: null };
        await tx.channelField.upsert({ where: { channelTypeId_key: { channelTypeId: row.id, key: f.key } }, create: { channelTypeId: row.id, key: f.key, ...data }, update: data });
      }
      const keys = type.fields.map((f) => f.key);
      await tx.channelField.updateMany({ where: { channelTypeId: row.id, goneAt: null, key: { notIn: keys } }, data: { goneAt: now } });
      // A first read is not "new": only a required field added to a type we already held is (Q22).
      if (before.length === 0) return [];
      const added = type.fields.filter((f) => f.requirement === "required" && !f.adapterFills && !wasRequired.has(f.key));
      if (added.length > 0) await tx.channelTypeChange.create({ data: { channelTypeId: row.id, added: added.map((f) => ({ key: f.key, label: f.label })) } });
      return added.map((f) => f.key);
    });
  },

  /** The live fields of some channel types, keyed "channel:type", in one read. */
  async fieldsFor(pairs: ReadonlyArray<{ channel: string; key: string }>): Promise<Map<string, CatalogueFieldRow[]>> {
    const out = new Map<string, CatalogueFieldRow[]>();
    if (pairs.length === 0) return out;
    const types = await prisma.channelType.findMany({
      where: { OR: pairs.map((p) => ({ channel: p.channel, key: p.key })), goneAt: null },
      select: { channel: true, key: true, fields: { where: { goneAt: null }, select: FIELD_SELECT, orderBy: { key: "asc" } } },
    });
    for (const t of types) out.set(`${t.channel}:${t.key}`, t.fields);
    return out;
  },

  /** Changes detected since a moment, with their type: Home's "{channel} now asks {n} more" line (Q22). */
  async changesSince(since: Date): Promise<Array<{ channel: string; typeKey: string; typeLabel: string; added: unknown; detectedAt: Date }>> {
    const rows = await prisma.channelTypeChange.findMany({
      where: { detectedAt: { gte: since } },
      select: { added: true, detectedAt: true, channelType: { select: { channel: true, key: true, label: true } } },
      orderBy: { detectedAt: "desc" },
    });
    return rows.map((r) => ({ channel: r.channelType.channel, typeKey: r.channelType.key, typeLabel: r.channelType.label, added: r.added, detectedAt: r.detectedAt }));
  },

  /** When each of some types was last read, for the readiness note "as of {date}" (A4). */
  async readAt(channel: string, keys: readonly string[]): Promise<Map<string, Date>> {
    if (keys.length === 0) return new Map();
    const rows = await prisma.channelType.findMany({ where: { channel, key: { in: [...keys] } }, select: { key: true, readAt: true } });
    return new Map(rows.map((r) => [r.key, r.readAt]));
  },
};
