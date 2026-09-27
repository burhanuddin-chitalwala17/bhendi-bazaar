import { prisma } from "@server/shared/prisma";
import type { Prisma } from "@prisma/client";

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
  deliveryPolicy: true,
  returnsPolicy: true,
  story: true,
  location: true,
  social: true,
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

export interface StorefrontSettingsData {
  tagline: string | null;
  description: string | null;
  logoUrl: string | null;
  heroUrl: string | null;
  accent: string | null;
  deliveryPolicy: string | null;
  returnsPolicy: string | null;
}

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
      select: { tagline: true, logoUrl: true, org: { select: { handle: true, name: true } } },
      orderBy: { org: { name: "asc" } },
    });
    return rows.map((row) => ({
      handle: row.org.handle,
      name: row.org.name,
      tagline: row.tagline,
      logoUrl: row.logoUrl,
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
   * Upsert rather than update: every org gets its row at creation, but a row is the kind of
   * thing a repair could lose, and the editor should heal it rather than 404.
   */
  async updateSettings(orgId: string, data: StorefrontSettingsData) {
    return await prisma.orgProfile.upsert({
      where: { orgId },
      create: { orgId, ...data },
      update: data,
      select: { orgId: true },
    });
  }
}

export const orgProfileRepository = new OrgProfileRepository();
