import { Prisma } from "@prisma/client";

import { prisma } from "@server/shared/prisma";

import { FIELD_REQUIREMENT, type CatalogueType } from "./channel-catalogue.types";

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

/** A stored channel type's live fields, and when the channel last described it (A4). */
export interface CatalogueTypeRow {
  label: string;
  readAt: Date;
  fields: CatalogueFieldRow[];
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
      const wasRequired = new Set(before.filter((f) => f.requirement === FIELD_REQUIREMENT.REQUIRED).map((f) => f.key));
      // One statement for every field: an Amazon type has hundreds, and a write each outlasts the transaction.
      // Ids are the template migration's, so a field keeps one id whichever path wrote it.
      if (type.fields.length > 0) {
        await tx.$executeRaw`
          INSERT INTO "ChannelField" ("id", "channelTypeId", "key", "label", "requirement", "kind", "allowedValues", "allowedUnits", "adapterFills", "readAt", "goneAt", "updatedAt")
          SELECT 'chf_' || md5(${`${channel}:${type.key}:`} || f.key), ${row.id}, f.key, f.label, f.requirement, f.kind,
                 NULLIF(f."allowedValues", 'null'::jsonb), NULLIF(f."allowedUnits", 'null'::jsonb), f."adapterFills", ${now}, NULL, now()
          FROM jsonb_to_recordset(${JSON.stringify(type.fields)}::jsonb)
            AS f("key" text, "label" text, "requirement" text, "kind" text, "allowedValues" jsonb, "allowedUnits" jsonb, "adapterFills" boolean)
          ON CONFLICT ("channelTypeId", "key") DO UPDATE SET
            "label" = EXCLUDED."label", "requirement" = EXCLUDED."requirement", "kind" = EXCLUDED."kind",
            "allowedValues" = EXCLUDED."allowedValues", "allowedUnits" = EXCLUDED."allowedUnits",
            "adapterFills" = EXCLUDED."adapterFills", "readAt" = EXCLUDED."readAt", "goneAt" = NULL, "updatedAt" = now()`;
      }
      const keys = type.fields.map((f) => f.key);
      await tx.channelField.updateMany({ where: { channelTypeId: row.id, goneAt: null, key: { notIn: keys } }, data: { goneAt: now } });
      // A first read is not "new": only a required field added to a type we already held is (Q22).
      if (before.length === 0) return [];
      const added = type.fields.filter((f) => f.requirement === FIELD_REQUIREMENT.REQUIRED && !f.adapterFills && !wasRequired.has(f.key));
      if (added.length > 0) await tx.channelTypeChange.create({ data: { channelTypeId: row.id, added: added.map((f) => ({ key: f.key, label: f.label })) } });
      return added.map((f) => f.key);
    });
  },

  /** The live fields of some channel types and when each was read, keyed "channel:type", in one read. */
  async fieldsFor(pairs: ReadonlyArray<{ channel: string; key: string }>): Promise<Map<string, CatalogueTypeRow>> {
    const out = new Map<string, CatalogueTypeRow>();
    if (pairs.length === 0) return out;
    const types = await prisma.channelType.findMany({
      where: { OR: pairs.map((p) => ({ channel: p.channel, key: p.key })), goneAt: null },
      select: { channel: true, key: true, label: true, readAt: true, fields: { where: { goneAt: null }, select: FIELD_SELECT, orderBy: { key: "asc" } } },
    });
    for (const t of types) out.set(`${t.channel}:${t.key}`, { label: t.label, readAt: t.readAt, fields: t.fields });
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

  /** The stored JSON Schema of some types, keyed "channel:type": a provider shapes and checks a listing by it (field-maps D5, D6). */
  async schemas(pairs: ReadonlyArray<{ channel: string; key: string }>): Promise<Map<string, unknown>> {
    if (pairs.length === 0) return new Map();
    const rows = await prisma.channelType.findMany({ where: { OR: pairs.map((p) => ({ channel: p.channel, key: p.key })), schema: { not: Prisma.DbNull } }, select: { channel: true, key: true, schema: true } });
    return new Map(rows.map((r) => [`${r.channel}:${r.key}`, r.schema]));
  },

  /** A channel's live types with how many required fields each asks the shop, for the admin's list (field-maps R6). */
  async typesOf(channel: string): Promise<Array<{ key: string; label: string; readAt: Date; required: string[] }>> {
    const rows = await prisma.channelType.findMany({
      where: { channel, goneAt: null },
      select: { key: true, label: true, readAt: true, fields: { where: { goneAt: null, requirement: FIELD_REQUIREMENT.REQUIRED, adapterFills: false }, select: { key: true } } },
      orderBy: { label: "asc" },
    });
    return rows.map((r) => ({ key: r.key, label: r.label, readAt: r.readAt, required: r.fields.map((f) => f.key) }));
  },
};
