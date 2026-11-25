import type { Prisma } from "@prisma/client";

import { prisma } from "@server/shared/prisma";
import type { MessagingAdvanced, ShopHours } from "./campaigns.types";
import { DEFAULT_HOURS } from "./messaging-rules";

type Db = Prisma.TransactionClient | typeof prisma;

const SELECT = {
  limitPaise: true,
  limitSetAt: true,
  hours: true,
  howOftenDay: true,
  howOftenWeek: true,
  greetingDelaySeconds: true,
  botPauseHours: true,
  alertsPerProductPerDay: true,
  version: true,
} as const;

export type MessagingSettingsRow = Prisma.MessagingSettingsGetPayload<{ select: typeof SELECT }>;

type Change =
  | { limitPaise: number | null; limitSetAt: Date }
  | { hours: ShopHours }
  | MessagingAdvanced;

/** The one way to reach `MessagingSettings` (ADR-0003). A first write creates the row with the defaults. */
export const messagingSettingsRepository = {
  async find(orgId: string, db: Db = prisma): Promise<MessagingSettingsRow | null> {
    return db.messagingSettings.findUnique({ where: { orgId }, select: SELECT });
  },

  /** Every change bumps `version`, which the settings page carries. */
  async apply(orgId: string, change: Change, tx: Prisma.TransactionClient): Promise<MessagingSettingsRow> {
    const fields = "hours" in change ? { hours: change.hours as unknown as Prisma.InputJsonObject } : change;
    return tx.messagingSettings.upsert({
      where: { orgId },
      create: { hours: DEFAULT_HOURS as unknown as Prisma.InputJsonObject, ...fields, orgId },
      update: { ...fields, version: { increment: 1 } },
      select: SELECT,
    });
  },
};
