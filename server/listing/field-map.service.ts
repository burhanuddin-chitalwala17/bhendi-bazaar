import type { Channel } from "@server/shared/channels";
import { prisma } from "@server/shared/prisma";

import { askCompleteness } from "./completeness.queue";
import { fieldMapRepository } from "./field-map.repository";
import { orgChannelRepository } from "./org-channel.repository";
import { FIELD_SOURCE } from "./field-map.types";
import { channelCatalogueRepository } from "./channel-catalogue.repository";
import { partsByField } from "./schema-parts";
import { DomainError } from "@server/shared/domain-error";

/** A map as the admin's edit sends it, already parsed (field-maps D8). */
export interface FieldMapChange {
  channel: string;
  channelType: string;
  fieldPath: string;
  bbType: string;
  source: string;
  key: string | null;
  constant: string | null;
  unitTarget: string | null;
  reason: string;
  values: Record<string, string>;
}

const CHECKED_BY_TEAM = "Changed by the team on the field-map screen";

/**
 * Changing a map (listing-model/field-maps R6): the next listing built for every product of the type
 * reads it (spec A4). The pairs given are the whole set.
 */
export const fieldMapService = {
  async save(change: FieldMapChange, now = new Date()): Promise<{ id: string }> {
    const reads = (source: string) => (change.source === source ? change.key : null);
    // A field in parts is mapped part by part, and only by the parts its type declares (Q23).
    const schema = (await channelCatalogueRepository.schemas([{ channel: change.channel, key: change.channelType }])).get(`${change.channel}:${change.channelType}`);
    const [field, ...rest] = change.fieldPath.split(".");
    const part = rest.join(".");
    const parts = partsByField(schema).get(field) ?? [];
    if (parts.length > 0 && !part) throw new DomainError(`${field} is in parts (${parts.join(", ")}). Map each part instead.`, { field: "fieldPath" });
    if (parts.length > 0 && !parts.includes(part)) throw new DomainError(`${field} has no part "${part}". Its parts are ${parts.join(", ")}.`, { field: "fieldPath" });
    const saved = await prisma.$transaction(async (tx) => {
      if (parts.length > 0) await fieldMapRepository.removeWhole({ channel: change.channel, channelType: change.channelType, fieldPath: field, bbType: change.bbType }, tx);
      return await fieldMapRepository.save({
        channel: change.channel, channelType: change.channelType, fieldPath: change.fieldPath, bbType: change.bbType,
        source: change.source,
        attributeKey: reads(FIELD_SOURCE.ATTRIBUTE) ?? (change.source === FIELD_SOURCE.CONSTANT ? change.key : null),
        ruleKey: reads(FIELD_SOURCE.RULE), coreKey: reads(FIELD_SOURCE.CORE), shopKey: reads(FIELD_SOURCE.SHOP),
        constant: change.source === FIELD_SOURCE.CONSTANT ? change.constant : null,
        unitTarget: change.unitTarget || null,
        checkedSource: CHECKED_BY_TEAM, checkedOn: now, reason: change.reason,
      }, change.values, tx);
    });
    // Every shop selling on the channel may be more or less complete now (dynamic-form D3).
    await askCompleteness(await orgChannelRepository.orgsWith(change.channel as Channel));
    return saved;
  },
};
