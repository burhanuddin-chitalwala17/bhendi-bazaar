import { prisma } from "@server/shared/prisma";

import { fieldMapRepository } from "./field-map.repository";
import { FIELD_SOURCE } from "./field-map.types";

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
    return await prisma.$transaction((tx) =>
      fieldMapRepository.save({
        channel: change.channel, channelType: change.channelType, fieldPath: change.fieldPath, bbType: change.bbType,
        source: change.source,
        attributeKey: reads(FIELD_SOURCE.ATTRIBUTE) ?? (change.source === FIELD_SOURCE.CONSTANT ? change.key : null),
        ruleKey: reads(FIELD_SOURCE.RULE), coreKey: reads(FIELD_SOURCE.CORE), shopKey: reads(FIELD_SOURCE.SHOP),
        constant: change.source === FIELD_SOURCE.CONSTANT ? change.constant : null,
        unitTarget: change.unitTarget || null,
        checkedSource: CHECKED_BY_TEAM, checkedOn: now, reason: change.reason,
      }, change.values, tx),
    );
  },
};
