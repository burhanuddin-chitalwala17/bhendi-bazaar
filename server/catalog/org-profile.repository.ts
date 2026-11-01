import { prisma } from "@server/shared/prisma";
import type { Prisma, ReturnsPreset } from "@prisma/client";

/**
 * The one reader and writer of `OrgProfile` (ADR-0003): an organisation's public face.
 *
 * Every public read selects from this table and takes only identity from `Org`, so a private
 * column can reach a buyer only through a join nobody wrote (org-profile spec R2, trd D3).
 * `PUBLIC_PROFILE_SELECT` is exported so `tests/unit/storefront-public-dto.test.ts` can hold
 * its key set against an allowlist.
 */
export const PUBLIC_PROFILE_SELECT = {
  tagline: true,
  description: true,
  logoUrl: true,
  heroUrl: true,
  accent: true,
  // `story` is read only to join it into "About your shop" (org-profile D4); never shown alone.
  story: true,
  storyMergedAt: true,
  returnsPreset: true,
  promiseNote: true,
  location: true,
  social: true,
  ownerName: true,
  ownerRole: true,
  ownerQuote: true,
  ownerPhotoUrl: true,
  // `pillars` is retired and kept (org-profile D5): never read for a buyer again.
  hiddenSections: true,
  // The published look (storefront-themes D1): keys into code, parsed on read.
  themeKey: true,
  paletteKey: true,
  // The themed page's content (D13): parsed on read, never shown raw.
  heroLine: true,
  claims: true,
  openingHours: true,
  storefrontHiddenSections: true,
} as const satisfies Prisma.OrgProfileSelect;

/**
 * What the org contributes to a public page: who it is and since when, never what it owes
 * or is owed. `joinedAt` is the brand page's "since" (brand-page R4) — a date, not a term.
 */
export const PUBLIC_ORG_IDENTITY_SELECT = {
  id: true,
  handle: true,
  name: true,
  joinedAt: true,
} as const satisfies Prisma.OrgSelect;

type JsonWrite = Prisma.InputJsonValue | typeof Prisma.JsonNull;

/**
 * The storefront editor's columns since org-profile U2: looks, never facts (D3), plus the themed
 * page's content and who saved it (storefront-themes D13).
 */
export interface StorefrontLooksData {
  heroUrl?: string | null;
  hiddenSections?: JsonWrite;
  heroLine?: string | null;
  claims?: JsonWrite;
  openingHours?: JsonWrite;
  storefrontHiddenSections?: JsonWrite;
  contentEditedByUserId: string;
  /** Written with `updatedAt` as one instant, so a later Shop details or look save is told apart. */
  contentEditedAt: Date;
  updatedAt: Date;
}

/**
 * The columns one Shop details section writes (org-profile D3). Each member is one section's
 * set, so no save can name a column outside its own section.
 */
export type ShopDetailsSectionData =
  | { tagline: string | null; logoUrl: string | null }
  | { description: string | null; storyMergedAt: Date }
  | { location: string | null }
  | { ownerName: string | null; ownerRole: string | null; ownerQuote: string | null; ownerPhotoUrl: string | null }
  | { social: Prisma.InputJsonValue | typeof Prisma.JsonNull }
  | { returnsPreset: ReturnsPreset; promiseNote: string | null };

/** A look write (storefront-themes D11): the keys, who and when, and what Switch back restores. */
export interface OrgLookWrite {
  themeKey: string | null;
  paletteKey: string | null;
  lookPublishedAt: Date;
  lookPublishedByUserId: string;
  previousThemeKey: string | null;
  previousPaletteKey: string | null;
  previousLookUntil: Date | null;
}

const LOOK_SELECT = {
  themeKey: true,
  paletteKey: true,
  lookVersion: true,
  lookPublishedAt: true,
  previousThemeKey: true,
  previousPaletteKey: true,
  previousLookUntil: true,
  lookPublishedBy: { select: { name: true } },
  org: { select: { id: true, handle: true, name: true } },
} as const satisfies Prisma.OrgProfileSelect;

const SHOP_DETAILS_SELECT = {
  updatedAt: true,
  tagline: true,
  logoUrl: true,
  description: true,
  story: true,
  storyMergedAt: true,
  location: true,
  social: true,
  ownerName: true,
  ownerRole: true,
  ownerQuote: true,
  ownerPhotoUrl: true,
  returnsPreset: true,
  promiseNote: true,
  deliveryPolicy: true,
  returnsPolicy: true,
  org: { select: { handle: true, name: true, phone: true, email: true, updatedAt: true } },
} as const satisfies Prisma.OrgProfileSelect;

export class OrgProfileRepository {
  /** The storefront's read: an active org's profile plus its public identity. */
  async findPublicByHandle(handle: string) {
    return await prisma.orgProfile.findFirst({
      where: { org: { handle, isActive: true } },
      select: { ...PUBLIC_PROFILE_SELECT, org: { select: PUBLIC_ORG_IDENTITY_SELECT } },
    });
  }

  /** The directory: every active shop with something on sale (storefront-discovery). */
  async listPublicShops() {
    const rows = await prisma.orgProfile.findMany({
      where: { org: { isActive: true, products: { some: { archivedAt: null } } } },
      select: { tagline: true, logoUrl: true, themeKey: true, org: { select: { handle: true, name: true } } },
      orderBy: { org: { name: "asc" } },
    });
    return rows.map((row) => ({
      handle: row.org.handle,
      name: row.org.name,
      tagline: row.tagline,
      logoUrl: row.logoUrl,
      themeKey: row.themeKey,
    }));
  }

  /** What the storefront editor edits, with the identity it shows beside the fields. */
  async findSettings(orgId: string) {
    const row = await prisma.orgProfile.findUnique({
      where: { orgId },
      select: {
        tagline: true,
        description: true,
        logoUrl: true,
        heroUrl: true,
        accent: true,
        deliveryPolicy: true,
        returnsPolicy: true,
        story: true,
        location: true,
        social: true,
        ownerName: true,
        ownerRole: true,
        ownerQuote: true,
        ownerPhotoUrl: true,
        hiddenSections: true,
        heroLine: true,
        claims: true,
        openingHours: true,
        storefrontHiddenSections: true,
        updatedAt: true,
        org: { select: { handle: true, name: true } },
      },
    });
    if (!row) return null;
    const { org, ...profile } = row;
    return { ...org, ...profile };
  }

  /** The one field an admin's org form edits on the public face. */
  async updateDescription(orgId: string, description: string | null) {
    return await prisma.orgProfile.upsert({
      where: { orgId },
      create: { orgId, description },
      update: { description },
      select: { orgId: true },
    });
  }

  /**
   * The editor's columns, only if nobody saved since `expectedUpdatedAt` (storefront-themes D13,
   * built on org-profile Q21's compare-and-set). False is a stale write or a missing row.
   */
  async updateLooksIfUnchanged(
    orgId: string,
    expectedUpdatedAt: Date,
    data: StorefrontLooksData,
    db: Pick<Prisma.TransactionClient, "orgProfile"> = prisma,
  ): Promise<boolean> {
    const { count } = await db.orgProfile.updateMany({ where: { orgId, updatedAt: expectedUpdatedAt }, data });
    return count === 1;
  }

  /** The row's version and the last content save, for "Changed by {Name}"; null without a row. */
  async findContentEditor(orgId: string) {
    return await prisma.orgProfile.findUnique({
      where: { orgId },
      select: { updatedAt: true, contentEditedAt: true, contentEditedBy: { select: { name: true } } },
    });
  }

  /** What Shop details shows and edits (org-profile D2), with the version it read. */
  async findShopDetails(orgId: string) {
    return await prisma.orgProfile.findUnique({ where: { orgId }, select: SHOP_DETAILS_SELECT });
  }

  /**
   * One section's columns, only if nobody saved since `expectedUpdatedAt` (Q21): a compare-and-set
   * on the row's version. False is a stale write or a missing row; the caller tells them apart.
   */
  async updateSectionIfUnchanged(
    orgId: string,
    expectedUpdatedAt: Date,
    data: ShopDetailsSectionData,
  ): Promise<boolean> {
    const { count } = await prisma.orgProfile.updateMany({
      where: { orgId, updatedAt: expectedUpdatedAt },
      data,
    });
    return count === 1;
  }

  /** When the row was last saved, for the "Someone changed this" message; null when there is none. */
  async findUpdatedAt(orgId: string): Promise<Date | null> {
    const row = await prisma.orgProfile.findUnique({ where: { orgId }, select: { updatedAt: true } });
    return row?.updatedAt ?? null;
  }

  /** The look as published, its version, who published it, and what Switch back restores. */
  async findLook(orgId: string) {
    return await prisma.orgProfile.findUnique({ where: { orgId }, select: LOOK_SELECT });
  }

  /**
   * Publish a look only at the version the editor saw (Q31): a compare-and-set that bumps the
   * version, so of two members publishing at once exactly one wins. False is a stale version.
   */
  async publishLookIfVersion(orgId: string, expectedVersion: number, data: OrgLookWrite): Promise<boolean> {
    const { count } = await prisma.orgProfile.updateMany({
      where: { orgId, lookVersion: expectedVersion },
      data: { ...data, lookVersion: { increment: 1 } },
    });
    return count === 1;
  }

  /** Profiles with a logo or hero that predates the asset record — the media backfill's input. */
  async listUnlinkedImages(take?: number) {
    return await prisma.orgProfile.findMany({
      where: { OR: [{ logoAssetId: null, logoUrl: { not: null } }, { heroAssetId: null, heroUrl: { not: null } }] },
      select: { orgId: true, logoUrl: true, logoAssetId: true, heroUrl: true, heroAssetId: true },
      ...(take === undefined ? {} : { take }),
    });
  }

  async linkImageAssets(orgId: string, data: { logoAssetId?: string; heroAssetId?: string }): Promise<void> {
    await prisma.orgProfile.update({ where: { orgId }, data });
  }
}

export const orgProfileRepository = new OrgProfileRepository();
