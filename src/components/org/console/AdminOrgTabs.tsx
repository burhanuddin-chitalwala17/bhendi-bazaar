"use client";

import { useSearchParams } from "next/navigation";

import { PageTabs } from "@/components/shared/page-tabs";
import { ORG_TABS_COPY } from "./org-console-copy";
import { ROUTES } from "@server/shared/routes";

/** The org console's sections that exist. Ones not built yet are absent, not greyed out (ADR-0053). */
const TABS = [
  { key: "dashboard", label: ORG_TABS_COPY.dashboard },
  { key: "products", label: ORG_TABS_COPY.products },
  { key: "orders", label: ORG_TABS_COPY.orders },
  { key: "earnings", label: ORG_TABS_COPY.earnings },
  { key: "reviews", label: ORG_TABS_COPY.reviews },
] as const;

interface Props {
  active: string;
  orgId: string;
}

export function AdminOrgTabs({ active, orgId }: Props) {
  const params = useSearchParams();

  return (
    <PageTabs
      label={ORG_TABS_COPY.label}
      current={active}
      tabs={TABS.map((tab) => {
        const next = new URLSearchParams(params.toString());
        next.set("tab", tab.key);
        // Paging belongs to the tab it was read in.
        next.delete("page");
        next.delete("more");
        return { key: tab.key, label: tab.label, href: `${ROUTES.admin.org(orgId)}?${next.toString()}` };
      })}
    />
  );
}
