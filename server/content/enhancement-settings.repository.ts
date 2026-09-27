import { prisma } from "@server/shared/prisma";
import { ENHANCEMENT_SETTINGS_ID } from "@server/content/enhancement.types";

export interface EnhancementSettingsRow {
  defaultMonthlyAllowance: number;
  dailyCapPaise: number;
  updatedAt: Date;
}

export interface SaveEnhancementSettingsInput {
  defaultMonthlyAllowance: number;
  /** Paise (Invariant 3). The form shows rupees and converts before it sends. */
  dailyCapPaise: number;
}

const SETTINGS_SELECT = {
  defaultMonthlyAllowance: true,
  dailyCapPaise: true,
  updatedAt: true,
} as const;

/**
 * The one reader and writer of `EnhancementSettings` (ADR-0003, image-enhancement trd D5).
 *
 * A singleton by construction rather than by convention: every statement here names the same id,
 * so a save is an upsert of that row and there is no path that writes a second. `read` answering
 * null is the ordinary case on a fresh database, not a fault — the service resolves the fallback.
 */
export class EnhancementSettingsRepository {
  async read(): Promise<EnhancementSettingsRow | null> {
    return await prisma.enhancementSettings.findUnique({
      where: { id: ENHANCEMENT_SETTINGS_ID },
      select: SETTINGS_SELECT,
    });
  }

  async save(input: SaveEnhancementSettingsInput): Promise<EnhancementSettingsRow> {
    return await prisma.enhancementSettings.upsert({
      where: { id: ENHANCEMENT_SETTINGS_ID },
      create: { id: ENHANCEMENT_SETTINGS_ID, ...input },
      update: input,
      select: SETTINGS_SELECT,
    });
  }
}

export const enhancementSettingsRepository = new EnhancementSettingsRepository();
