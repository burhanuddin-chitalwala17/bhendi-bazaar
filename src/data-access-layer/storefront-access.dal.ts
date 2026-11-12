import { cache } from "react";
import type { Metadata } from "next";

import { isPlatformAdminSession, optionalActiveSession } from "@/lib/admin-auth";
import { orgMemberRepository } from "@server/catalog/org.member.repository";
import { featureAccessService } from "@server/subscriptions/feature-access.service";
import { FEATURE } from "@server/subscriptions/feature-access.types";

/**
 * How a viewer meets a shop's own storefront while Storefront is a paid feature
 * (subscriptions/feature-access D10, D11). Memoised per request, never across: a switch shows on
 * the next view (Q17).
 */
export const STOREFRONT_ACCESS = { OPEN: "open", TEAM: "team", CLOSED: "closed" } as const;
export type StorefrontAccess = (typeof STOREFRONT_ACCESS)[keyof typeof STOREFRONT_ACCESS];

export const storefrontAccessDAL = {
  /** Which of these shops hold Storefront: the directory and the sitemap, one read (D10). */
  openAmong: async (orgIds: readonly string[]): Promise<Set<string>> => featureAccessService.allowedOrgs(FEATURE.STOREFRONT, orgIds),

  /** Open to everyone: the product page's "Sold by" link (Q27). */
  isOpen: cache(async (orgId: string): Promise<boolean> => featureAccessService.can(orgId, FEATURE.STOREFRONT)),

  /**
   * Open; locked but the viewer is the shop's team or the platform's, who see it under a banner (Q6);
   * or closed to them. The session is read only for a locked shop, so an open store pays nothing extra.
   */
  forViewer: cache(async (orgId: string): Promise<StorefrontAccess> => {
    if (await storefrontAccessDAL.isOpen(orgId)) return STOREFRONT_ACCESS.OPEN;
    const session = await optionalActiveSession({ onBlocked: "guest" });
    if (!session) return STOREFRONT_ACCESS.CLOSED;
    if (isPlatformAdminSession(session)) return STOREFRONT_ACCESS.TEAM;
    return (await orgMemberRepository.findMembership(session.user.id, orgId)) ? STOREFRONT_ACCESS.TEAM : STOREFRONT_ACCESS.CLOSED;
  }),
};

/**
 * A locked storefront's page metadata, for everyone (feature-access D11, Q7): not indexed, and no link
 * preview, whatever the viewer. A crawler is never the shop's team; a pasted link shows nothing.
 * Null when the storefront is open and the page builds its own.
 */
export async function lockedStorefrontMetadata(orgId: string, shop: string): Promise<Metadata | null> {
  if (await storefrontAccessDAL.isOpen(orgId)) return null;
  return { title: shop, robots: { index: false, follow: false } };
}

/** Whether this viewer meets the closed page: every storefront page asks this before reading its content (D11). */
export async function storefrontClosedTo(orgId: string): Promise<boolean> {
  return (await storefrontAccessDAL.forViewer(orgId)) === STOREFRONT_ACCESS.CLOSED;
}
