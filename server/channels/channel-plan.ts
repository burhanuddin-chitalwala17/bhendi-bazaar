import { featureAccessService } from "@server/subscriptions/feature-access.service";
import { FEATURE } from "@server/subscriptions/feature-access.types";

/**
 * Channels is a paid feature (subscriptions/feature-access D5). Every channel action asks here, so
 * only this file reaches `subscriptions`; the services stay within their own two domains.
 */
export const channelPlan = {
  assert: (orgId: string) => featureAccessService.assert(orgId, FEATURE.CHANNELS),
  can: (orgId: string) => featureAccessService.can(orgId, FEATURE.CHANNELS),
  /** The orgs among these that hold Channels: one read for a pass over many shops (D8). */
  allowed: (orgIds: readonly string[]) => featureAccessService.allowedOrgs(FEATURE.CHANNELS, orgIds),
};
