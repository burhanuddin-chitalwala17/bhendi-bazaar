import { THEMES, type PaletteKey, type ThemeKey } from "@server/catalog/storefront-themes";

/** Q4: "Switch back" works this long after a publish. */
export const LOOK_KEPT_DAYS = 30;

/** ux.md picker, Refused: publishing is the owner's alone (Q31). */
export const LOOK_OWNER_ONLY = "Only the shop's owner can change its look.";

/** A switch back asked for after the 30 days (Q4); the picker stops offering it then. */
export const LOOK_NOT_KEPT = "Your previous look is no longer kept.";

/** What a shop asks to publish, and the look version its editor saw (D11, Q31). */
export interface StorefrontLookInput {
  theme: ThemeKey;
  palette: PaletteKey;
  lookVersion: number;
}

/** A switch back carries only the version it saw (Q4, Q31). */
export interface StorefrontRevertInput {
  lookVersion: number;
}

/** A look as stored: a theme and palette, or neither — the shop's page before any theme (Q19, Q42). */
export interface LookKeys {
  theme: ThemeKey | null;
  palette: PaletteKey | null;
}

/** The picker's read (D11): what is live, at which version, and what Switch back restores. */
export interface StorefrontLookState {
  orgId: string;
  handle: string;
  name: string;
  live: LookKeys;
  lookVersion: number;
  /** Null until the shop's first publish. */
  publishedAt: string | null;
  /** The look Switch back restores, while it is kept; null when there is none. */
  previous: (LookKeys & { until: string }) | null;
}

/** "Edge", or "your old page" for the shop's page before any theme (Q42). */
export function lookName(theme: ThemeKey | null): string {
  return theme ? THEMES[theme].label : "your old page";
}

/** ux.md journey 4, Refused: "{Name} published {theme} {n} min ago." */
export function lookConflictMessage(
  who: string | null,
  theme: ThemeKey | null,
  publishedAt: Date | null,
  now = new Date(),
): string {
  const minutes = publishedAt ? Math.max(1, Math.round((now.getTime() - publishedAt.getTime()) / 60_000)) : 1;
  return `${who?.trim() || "Someone"} published ${lookName(theme)} ${minutes} min ago.`;
}
