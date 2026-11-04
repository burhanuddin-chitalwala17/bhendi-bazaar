"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { PortalSidebar, type PortalNavGroup, type PortalNavItem } from "@/components/layout/PortalSidebar";
import { OrgTabBar, type TabCounts } from "@/components/layout/org-tab-bar";
import {
  PORTAL_ACTION,
  PORTAL_GROUP_LABEL,
  PORTAL_GROUPS,
  PORTAL_NAV,
  activePortalEntry,
  portalHref,
  type PortalNavEntry,
} from "@/components/layout/portal-nav";
import { ContactSheet } from "@/components/support/contact-sheet";
import { OrgSwitcher, type SwitcherOrg } from "@/components/org/org-switcher";

/**
 * The shop portal's navigation: the phone tab bar, and the grouped list that is More on a
 * phone and the sidebar from md (own-store onboarding D1, D2). Both read `PORTAL_NAV`.
 */
export function OrgSidebar({
  orgId,
  orgs,
  signedIn,
  counts,
}: {
  orgId: string;
  orgs: SwitcherOrg[];
  signedIn: boolean;
  counts?: TabCounts;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const activeKey = activePortalEntry(orgId, pathname)?.key;

  const toItem = (entry: PortalNavEntry): PortalNavItem => ({
    title: entry.label,
    purpose: entry.purpose,
    icon: entry.icon,
    href: portalHref(entry, orgId) ?? undefined,
    active: entry.key === activeKey,
    count: counts?.[entry.key],
    onSelect:
      "action" in entry.target && entry.target.action === PORTAL_ACTION.CONTACT
        ? () => setHelpOpen(true)
        : undefined,
  });

  // Home has no group and leads the list, so the sidebar alone still reaches them.
  const groups: PortalNavGroup[] = [
    { items: PORTAL_NAV.filter((entry) => !entry.group).map(toItem) },
    ...PORTAL_GROUPS.map((group) => ({
      label: PORTAL_GROUP_LABEL[group],
      items: PORTAL_NAV.filter((entry) => entry.group === group).map(toItem),
    })),
  ];

  return (
    <>
      <PortalSidebar
        header={<OrgSwitcher orgs={orgs} currentOrgId={orgId} />}
        groups={groups}
        anchor="bottom"
        open={moreOpen}
        onOpenChange={setMoreOpen}
      />
      <OrgTabBar orgId={orgId} moreOpen={moreOpen} onMore={() => setMoreOpen(true)} counts={counts} />
      <ContactSheet open={helpOpen} onOpenChange={setHelpOpen} signedIn={signedIn} />
    </>
  );
}
