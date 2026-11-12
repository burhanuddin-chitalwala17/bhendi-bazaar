import { prisma } from "@server/shared/prisma";
import type { Feature } from "./feature-access.types";

/**
 * The one way to reach `OrgFeature` (ADR-0003). An absent row is locked; nothing here writes a
 * default row on a shop's behalf (subscriptions/feature-access D3).
 */

export interface OrgFeatureRow {
  feature: string;
  enabled: boolean;
  changedAt: Date;
  changedBy: { name: string | null; email: string | null } | null;
}

const ROW = {
  feature: true,
  enabled: true,
  changedAt: true,
  changedBy: { select: { name: true, email: true } },
} as const;

export const orgFeatureRepository = {
  /** The features this shop holds: one primary-key range read (D6). */
  async enabledFor(orgId: string): Promise<string[]> {
    const rows = await prisma.orgFeature.findMany({ where: { orgId, enabled: true }, select: { feature: true } });
    return rows.map((row) => row.feature);
  },

  /** Every switch this shop has, with who and when, for the admin's Plan tab. */
  async rowsFor(orgId: string): Promise<OrgFeatureRow[]> {
    return await prisma.orgFeature.findMany({ where: { orgId }, select: ROW });
  },

  /** Which of these orgs (or of all orgs) hold a feature: one read for a pass or a filter (D8, D10). */
  async orgsWith(feature: Feature, orgIds?: readonly string[]): Promise<string[]> {
    const rows = await prisma.orgFeature.findMany({
      where: { feature, enabled: true, ...(orgIds ? { orgId: { in: [...orgIds] } } : {}) },
      select: { orgId: true },
    });
    return rows.map((row) => row.orgId);
  },

  /** The admin's switch. Last write wins; the stored row is returned so a stale screen re-reads (D12). */
  async set(orgId: string, feature: Feature, enabled: boolean, changedById: string, now: Date): Promise<OrgFeatureRow> {
    return await prisma.orgFeature.upsert({
      where: { orgId_feature: { orgId, feature } },
      create: { orgId, feature, enabled, changedById, changedAt: now },
      update: { enabled, changedById, changedAt: now },
      select: ROW,
    });
  },
};
