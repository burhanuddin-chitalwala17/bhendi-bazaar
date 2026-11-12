import { FeatureLockedError, DomainError, NotFoundError } from "@server/shared/domain-error";
import { homeBrandOrgId } from "@server/shared/home-brand";
import { recordAdminAction } from "@server/shared/audit/audit.service";
import { orgFeatureRepository } from "./org-feature.repository";
import {
  ALL_ON,
  FEATURE,
  FEATURES,
  FEATURE_LABEL,
  holds,
  type Feature,
  type FeatureAccessDTO,
  type FeatureSwitchDTO,
  type OrgPlanDTO,
} from "./feature-access.types";

/**
 * May this shop use this paid feature now? The one question every domain asks
 * (subscriptions/feature-access D4). Imports only `shared`, so any domain can call it (D1).
 * Read on every call, never cached across requests: a switch shows on the next screen (Q17).
 */

const isHomeBrand = (orgId: string) => orgId === homeBrandOrgId();

function toAccess(enabled: readonly string[]): FeatureAccessDTO {
  const has = new Set(enabled);
  return {
    channels: has.has(FEATURE.CHANNELS),
    storefront: has.has(FEATURE.STOREFRONT),
    imageEnhancement: has.has(FEATURE.IMAGE_ENHANCEMENT),
  };
}

export { holds };

export function lockedError(feature: Feature): FeatureLockedError {
  return new FeatureLockedError(feature, FEATURE_LABEL[feature]);
}

export const featureAccessService = {
  /** The shop's three answers; the home brand holds all with no read (Q13). */
  async forOrg(orgId: string): Promise<FeatureAccessDTO> {
    if (isHomeBrand(orgId)) return ALL_ON;
    return toAccess(await orgFeatureRepository.enabledFor(orgId));
  },

  async can(orgId: string, feature: Feature): Promise<boolean> {
    return holds(await this.forOrg(orgId), feature);
  },

  /** Refuse with the lock the envelope names (D4). Call before any marketplace call, slot or write. */
  async assert(orgId: string, feature: Feature): Promise<void> {
    if (!(await this.can(orgId, feature))) throw lockedError(feature);
  },

  /**
   * Which orgs hold a feature, for a filter or a pass over many shops: one read (D8, D10). Given
   * `orgIds`, answers among those; the home brand is always among the answer when asked about.
   */
  async allowedOrgs(feature: Feature, orgIds?: readonly string[]): Promise<Set<string>> {
    const allowed = new Set(await orgFeatureRepository.orgsWith(feature, orgIds));
    const home = homeBrandOrgId();
    if (home && (!orgIds || orgIds.includes(home))) allowed.add(home);
    return allowed;
  },

  /** The admin's Plan tab: every switch, absent ones as off and never changed (D12). */
  async planFor(orgId: string): Promise<OrgPlanDTO> {
    if (isHomeBrand(orgId)) return { homeBrand: true, switches: [] };
    const rows = new Map((await orgFeatureRepository.rowsFor(orgId)).map((row) => [row.feature, row]));
    return {
      homeBrand: false,
      switches: FEATURES.map((feature): FeatureSwitchDTO => {
        const row = rows.get(feature);
        return row
          ? { feature, enabled: row.enabled, changedAt: row.changedAt.toISOString(), changedBy: row.changedBy }
          : { feature, enabled: false, changedAt: null, changedBy: null };
      }),
    };
  },

  /** The admin's switch: a named command, audited; the trail never fails it (D12, ADR-0021). */
  async set(adminId: string, orgId: string, feature: Feature, enabled: boolean, now = new Date()): Promise<FeatureSwitchDTO> {
    if (isHomeBrand(orgId)) throw new DomainError("The home brand keeps every feature on", { status: 409 });
    const row = await orgFeatureRepository.set(orgId, feature, enabled, adminId, now).catch((error: unknown) => {
      // The only foreign key the switch can miss is the shop's own: an unknown shop is not found, not a fault.
      if (error && typeof error === "object" && "code" in error && error.code === "P2003") throw new NotFoundError("Shop not found");
      throw error;
    });
    await recordAdminAction({
      adminId,
      action: enabled ? "feature.enabled" : "feature.disabled",
      resource: "org",
      resourceId: orgId,
      metadata: { feature },
    });
    return { feature, enabled: row.enabled, changedAt: row.changedAt.toISOString(), changedBy: row.changedBy };
  },
};
