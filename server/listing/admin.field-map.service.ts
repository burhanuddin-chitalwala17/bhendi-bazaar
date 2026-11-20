import { CHANNEL_LABELS, isChannel } from "@server/shared/channels";

import type { AdminChannelTypeDTO, AdminFieldMapDTO, AdminFieldMapsDTO } from "./admin.field-map.types";
import { FIELD_KIND, FIELD_REQUIREMENT } from "./channel-catalogue.types";
import { channelCatalogueRepository } from "./channel-catalogue.repository";
import { fieldMapRepository } from "./field-map.repository";
import { CORE_KEYS, FIELD_SOURCE, PLANNED_ATTRIBUTES, SHOP_KEYS, fieldsOf, fillsToday, type FieldMapRow } from "./field-map.types";
import { RULE_KEYS } from "./field-rules";
import { FACTS, FACT_DECLARATIONS, MEASURES, type FactKey } from "./listing-facts";
import { listingValueRepository } from "./listing-value.repository";
import { partsByField } from "./schema-parts";

const ALERT_DAYS = 14;
const TODAY = new Set<string>([...FACTS, ...MEASURES]);
const DAY_MS = 86_400_000;
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

const keyOf = (m: FieldMapRow) => m.attributeKey ?? m.ruleKey ?? m.coreKey ?? m.shopKey ?? null;

/**
 * The admin's view of how each channel field is filled (listing-model/field-maps R6, ux.md): a read model
 * over the catalogue, the maps and our lists (ADR-0055).
 */
export const adminFieldMapService = {
  /** A channel's types, each with its required fields and how many no map fills. */
  async types(channel: string): Promise<AdminChannelTypeDTO[]> {
    const types = await channelCatalogueRepository.typesOf(channel);
    const maps = await fieldMapRepository.forTypes(types.map((t) => ({ channel, channelType: t.key })));
    return types.map((t) => {
      const covered = new Set(maps.filter((m) => m.channelType === t.key && fillsToday(m, TODAY)).flatMap((m) => fieldsOf(m.fieldPath)));
      return { key: t.key, label: t.label, required: t.required.length, unmapped: t.required.filter((k) => !covered.has(k)).length };
    });
  },

  /** One channel type: every field with its maps, newest requirements marked, unpaired answers counted. Null when unknown. */
  async view(channel: string, typeKey: string, now = new Date()): Promise<AdminFieldMapsDTO | null> {
    if (!isChannel(channel)) return null;
    const [catalogue, maps, changes, schemas] = await Promise.all([
      channelCatalogueRepository.fieldsFor([{ channel, key: typeKey }]),
      fieldMapRepository.forTypes([{ channel, channelType: typeKey }]),
      channelCatalogueRepository.changesSince(new Date(now.getTime() - ALERT_DAYS * DAY_MS)),
      channelCatalogueRepository.schemas([{ channel, key: typeKey }]),
    ]);
    const parts = partsByField(schemas.get(`${channel}:${typeKey}`));
    const type = catalogue.get(`${channel}:${typeKey}`);
    if (!type && maps.length === 0) return null;
    const lists = [...new Set(maps.flatMap((m) => (m.attributeKey && FACT_DECLARATIONS[m.attributeKey as FactKey]?.list ? [FACT_DECLARATIONS[m.attributeKey as FactKey].list!] : [])))];
    const options = await listingValueRepository.byLists(lists, null);

    const addedOn = new Map<string, string>();
    for (const c of changes.filter((c) => c.channel === channel && c.typeKey === typeKey)) {
      for (const a of Array.isArray(c.added) ? (c.added as Array<{ key?: string }>) : []) if (a.key && !addedOn.has(a.key)) addedOn.set(a.key, c.detectedAt.toISOString());
    }
    const fields = type?.fields ?? [];
    const fieldKeys = new Set(fields.map((f) => f.key));
    const fieldOfMap = (m: FieldMapRow) => fieldsOf(m.fieldPath).find((k) => fieldKeys.has(k)) ?? fieldsOf(m.fieldPath).at(-1)!;

    const toDTO = (m: FieldMapRow, allowed: string[], closed: boolean): AdminFieldMapDTO => {
      const waiting = m.source === FIELD_SOURCE.ATTRIBUTE && !fillsToday(m, TODAY);
      const list = m.attributeKey ? FACT_DECLARATIONS[m.attributeKey as FactKey]?.list : undefined;
      const unpaired = list && closed && allowed.length > 0
        ? (options[list] ?? []).filter((o) => !Object.hasOwn(m.values, o.key) && !allowed.some((a) => same(a, o.label))).map((o) => ({ optionKey: o.key, label: o.label }))
        : [];
      return {
        fieldPath: m.fieldPath, bbType: m.bbType, source: m.source, key: keyOf(m), constant: m.constant, unitTarget: m.unitTarget,
        reason: m.reason, checkedSource: m.checkedSource, checkedOn: m.checkedOn.toISOString(), values: m.values, unpaired,
        allowed: closed ? allowed : [], waiting, wholeOnParts: (parts.get(m.fieldPath)?.length ?? 0) > 0,
      };
    };

    const order = [FIELD_REQUIREMENT.REQUIRED, FIELD_REQUIREMENT.CONDITIONAL, FIELD_REQUIREMENT.OPTIONAL] as string[];
    const rows = fields
      .map((f) => {
        const allowed = Array.isArray(f.allowedValues) ? (f.allowedValues as unknown[]).map(String) : [];
        return {
          field: f.key, label: f.label, requirement: f.requirement, adapterFills: f.adapterFills, addedOn: addedOn.get(f.key) ?? null, parts: parts.get(f.key) ?? [],
          maps: maps.filter((m) => fieldOfMap(m) === f.key).map((m) => toDTO(m, allowed, f.kind === FIELD_KIND.CHOICE)),
        };
      })
      // A map whose field the channel no longer lists still shows, so it can be seen and changed.
      .concat(maps.filter((m) => !fieldKeys.has(fieldOfMap(m))).map((m) => ({ field: fieldOfMap(m), label: fieldOfMap(m), requirement: FIELD_REQUIREMENT.OPTIONAL, adapterFills: false, addedOn: null, parts: [] as string[], maps: [toDTO(m, [], false)] })))
      .sort((a, b) => order.indexOf(a.requirement) - order.indexOf(b.requirement) || a.label.localeCompare(b.label));

    return {
      channel, channelLabel: CHANNEL_LABELS[channel], typeKey, typeLabel: type?.label ?? typeKey, readAt: type?.readAt.toISOString() ?? null, rows,
      choices: {
        attributes: [
          ...FACTS.map((f) => ({ key: f as string, label: FACT_DECLARATIONS[f].label, planned: false })),
          ...MEASURES.map((m) => ({ key: m as string, label: m, planned: false })),
          ...PLANNED_ATTRIBUTES.map((a) => ({ key: a as string, label: a, planned: true })),
        ],
        rules: [...RULE_KEYS], core: [...CORE_KEYS], shop: [...SHOP_KEYS],
      },
    };
  },
};
