/**
 * A shop's published look (storefront-themes D11; Q4, Q31). Content saves are live at once; the
 * look waits for Publish, is the owner's alone, and keeps the one before it for 30 days.
 */

import { OrgRole } from "@prisma/client";

import { orgProfileRepository } from "@server/catalog/org-profile.repository";
import { THEME_KEYS, THEMES, suggestedTheme, type PaletteKey } from "@server/catalog/storefront-themes";
import { SHOP_KINDS } from "@server/catalog/storefront-claims";
import { productsRepository } from "@server/catalog/product.read.repository";
import {
  LOOK_KEPT_DAYS,
  LOOK_NOT_KEPT,
  LOOK_OWNER_ONLY,
  lookConflictMessage,
  type LookKeys,
  type StorefrontLookInput,
  type StorefrontLookState,
  type StorefrontRevertInput,
} from "@server/catalog/storefront-look.types";
import { recordAdminAction } from "@server/shared/audit/audit.service";
import { ConflictError, DomainError, ForbiddenError, NotFoundError } from "@server/shared/domain-error";

export const LOOK_AUDIT = { PUBLISHED: "ORG_LOOK_PUBLISHED", REVERTED: "ORG_LOOK_REVERTED" } as const;

const DAY_MS = 24 * 60 * 60 * 1000;

interface Actor {
  userId: string;
  role: OrgRole;
}

/**
 * Stored keys parsed on read (D1). Unlike `readStorefrontLook`, a stored palette not of its theme
 * reads as none rather than the default, so a switch back never restores a look nobody chose.
 */
function keysOf(themeKey: string | null, paletteKey: string | null): LookKeys {
  const theme = THEME_KEYS.find((key) => key === themeKey) ?? null;
  if (!theme) return { theme: null, palette: null };
  const palettes = THEMES[theme].palettes;
  const palette: PaletteKey = (palettes.find((p) => p.key === paletteKey) ?? palettes[0]).key;
  return { theme, palette };
}

const sameLook = (a: LookKeys, b: LookKeys) => a.theme === b.theme && a.palette === b.palette;

type LookRow = NonNullable<Awaited<ReturnType<typeof orgProfileRepository.findLook>>>;

async function readRow(orgId: string): Promise<LookRow> {
  const row = await orgProfileRepository.findLook(orgId);
  if (!row) throw new NotFoundError("Organisation not found");
  return row;
}

function previousOf(row: LookRow, now: Date): StorefrontLookState["previous"] {
  if (!row.previousLookUntil || row.previousLookUntil <= now) return null;
  return { ...keysOf(row.previousThemeKey, row.previousPaletteKey), until: row.previousLookUntil.toISOString() };
}

/**
 * Write `next` at the version the actor saw; the look it replaces becomes the one Switch back
 * restores, unless nothing changed. A miss is the Refused state: who published what, and when.
 */
async function writeLook(orgId: string, actor: Actor, expectedVersion: number, next: LookKeys, action: string) {
  if (actor.role !== OrgRole.OWNER) throw new ForbiddenError(LOOK_OWNER_ONLY);
  const row = await readRow(orgId);
  const now = new Date();
  const live = keysOf(row.themeKey, row.paletteKey);
  const kept = sameLook(live, next)
    ? { previousThemeKey: row.previousThemeKey, previousPaletteKey: row.previousPaletteKey, previousLookUntil: row.previousLookUntil }
    : { previousThemeKey: live.theme, previousPaletteKey: live.palette, previousLookUntil: new Date(now.getTime() + LOOK_KEPT_DAYS * DAY_MS) };

  // The version check is the write's own (Q31), so two publishes racing past this read still meet it.
  const written = await orgProfileRepository.publishLookIfVersion(orgId, expectedVersion, {
    themeKey: next.theme,
    paletteKey: next.palette,
    lookPublishedAt: now,
    lookPublishedByUserId: actor.userId,
    ...kept,
  });
  if (!written) {
    const current = await readRow(orgId);
    throw new ConflictError(
      lookConflictMessage(current.lookPublishedBy?.name ?? null, keysOf(current.themeKey, current.paletteKey).theme, current.lookPublishedAt, now),
    );
  }

  // After the write and never deciding it (ADR-0021).
  await recordAdminAction({
    adminId: actor.userId,
    action,
    resource: "OrgProfile",
    resourceId: orgId,
    metadata: { from: live, to: next },
  });
  return await storefrontLookService.getLook(orgId);
}

export const storefrontLookService = {
  async getLook(orgId: string): Promise<StorefrontLookState> {
    const [row, productType] = await Promise.all([readRow(orgId), productsRepository.mainProductTypeForOrg(orgId)]);
    const theme = suggestedTheme(productType);
    return {
      suggested: theme && productType ? { theme, label: SHOP_KINDS[productType]?.label ?? productType } : null,
      orgId: row.org.id,
      handle: row.org.handle,
      name: row.org.name,
      live: keysOf(row.themeKey, row.paletteKey),
      lookVersion: row.lookVersion,
      publishedAt: row.lookPublishedAt?.toISOString() ?? null,
      previous: previousOf(row, new Date()),
    };
  },

  /** Publish (D11): live for every buyer on the next load (A9). */
  async publish(orgId: string, actor: Actor, input: StorefrontLookInput): Promise<StorefrontLookState> {
    const next: LookKeys = { theme: input.theme, palette: input.palette };
    return await writeLook(orgId, actor, input.lookVersion, next, LOOK_AUDIT.PUBLISHED);
  },

  /** Switch back (Q4): the kept look, within its 30 days, again at the version the actor saw. */
  async revert(orgId: string, actor: Actor, input: StorefrontRevertInput): Promise<StorefrontLookState> {
    if (actor.role !== OrgRole.OWNER) throw new ForbiddenError(LOOK_OWNER_ONLY);
    const previous = previousOf(await readRow(orgId), new Date());
    // 410, not 409: a resend cannot succeed, so the client must not offer one.
    if (!previous) throw new DomainError(LOOK_NOT_KEPT, { status: 410 });
    return await writeLook(orgId, actor, input.lookVersion, previous, LOOK_AUDIT.REVERTED);
  },
};
