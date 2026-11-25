import type { Prisma } from "@prisma/client";

import { recordAdminActionIn } from "@server/shared/audit/audit.service";
import { prisma } from "@server/shared/prisma";
import { WEEKDAYS, type DayHours, type MessagingAdvanced, type MessagingSettingsDTO, type ShopHours } from "./campaigns.types";
import { assertAdvanced, assertHours, assertLimit, DEFAULT_ADVANCED, DEFAULT_HOURS } from "./messaging-rules";
import { messagingSettingsRepository, type MessagingSettingsRow } from "./messaging-settings.repository";

const RESOURCE = "MessagingSettings";

const isDay = (v: unknown): v is DayHours =>
  typeof v === "object" && v !== null && typeof (v as DayHours).open === "string" && typeof (v as DayHours).close === "string";

/** The stored JSON as `ShopHours`; a day that does not read as hours falls back to its default. */
function readHours(json: Prisma.JsonValue): ShopHours {
  const stored = (json ?? {}) as Record<string, unknown>;
  return Object.fromEntries(
    WEEKDAYS.map((day) => [day, stored[day] === null ? null : isDay(stored[day]) ? stored[day] : DEFAULT_HOURS[day]]),
  ) as ShopHours;
}

function toDto(row: MessagingSettingsRow | null): MessagingSettingsDTO {
  if (!row) return { limitPaise: null, limitSet: false, hours: DEFAULT_HOURS, version: 0, ...DEFAULT_ADVANCED };
  return {
    limitPaise: row.limitPaise,
    limitSet: row.limitSetAt !== null,
    hours: readHours(row.hours),
    version: row.version,
    howOftenDay: row.howOftenDay,
    howOftenWeek: row.howOftenWeek,
    greetingDelaySeconds: row.greetingDelaySeconds,
    botPauseHours: row.botPauseHours,
    alertsPerProductPerDay: row.alertsPerProductPerDay,
  };
}

/** Each change and its audit entry commit together (D7, R9). */
async function change(
  orgId: string,
  actorId: string,
  action: string,
  apply: Parameters<typeof messagingSettingsRepository.apply>[1],
): Promise<MessagingSettingsDTO> {
  return prisma.$transaction(async (tx) => {
    const row = await messagingSettingsRepository.apply(orgId, apply, tx);
    await recordAdminActionIn(tx, { adminId: actorId, action, resource: RESOURCE, resourceId: orgId, metadata: { ...apply } });
    return toDto(row);
  });
}

/** A shop's messaging settings (social-selling/whatsapp-sending D4, D6). */
export const messagingSettingsService = {
  async get(orgId: string, tx?: Prisma.TransactionClient): Promise<MessagingSettingsDTO> {
    return toDto(await messagingSettingsRepository.find(orgId, tx));
  },

  /** Whether the shop has answered the limit step, with an amount or "No limit" (R2). */
  async limitSet(orgId: string): Promise<boolean> {
    return (await this.get(orgId)).limitSet;
  },

  /** The one set of shop hours: automatic replies and the window alerts go in (parent Q112). */
  async hoursFor(orgId: string): Promise<ShopHours> {
    return (await this.get(orgId)).hours;
  },

  /** An amount of at least ₹100, or null for "No limit". Held sends wait for Send held (ux.md journey 3). */
  async setLimit(orgId: string, actorId: string, limitPaise: number | null): Promise<MessagingSettingsDTO> {
    assertLimit(limitPaise);
    return change(orgId, actorId, "MESSAGING_LIMIT_SET", { limitPaise, limitSetAt: new Date() });
  },

  async setHours(orgId: string, actorId: string, hours: ShopHours): Promise<MessagingSettingsDTO> {
    assertHours(hours);
    const whitelisted = Object.fromEntries(
      WEEKDAYS.map((day) => [day, hours[day] && { open: hours[day].open, close: hours[day].close }]),
    ) as ShopHours;
    return change(orgId, actorId, "MESSAGING_HOURS_SET", { hours: whitelisted });
  },

  async setAdvanced(orgId: string, actorId: string, advanced: MessagingAdvanced): Promise<MessagingSettingsDTO> {
    assertAdvanced(advanced);
    const { howOftenDay, howOftenWeek, greetingDelaySeconds, botPauseHours, alertsPerProductPerDay } = advanced;
    return change(orgId, actorId, "MESSAGING_ADVANCED_SET", { howOftenDay, howOftenWeek, greetingDelaySeconds, botPauseHours, alertsPerProductPerDay });
  },
};
