"use client";

import { ResourceList } from "@/components/shared/resource-list";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { Money } from "@/components/shared/Money";
import { bpsToPercent, formatCount } from "@/lib/format";
import type { payoutsDAL } from "@/data-access-layer/payouts.dal";
import { PAYOUT_ORG_LIST_COPY } from "./payouts-copy";
import { ROUTES } from "@server/shared/routes";

type PayoutOrgRow = Awaited<ReturnType<typeof payoutsDAL.overview>>["orgs"][number];

/** Every shop's two balances, never merged into one number; a row opens the shop's ledger. */
export function PayoutOrgList({ orgs }: { orgs: PayoutOrgRow[] }) {
  return (
    <ResourceList
      label={PAYOUT_ORG_LIST_COPY.label}
      rows={orgs}
      rowKey={(org) => org.id}
      rowHref={(org) => ROUTES.admin.orgPayouts(org.id)}
      empty={{ title: PAYOUT_ORG_LIST_COPY.emptyTitle, description: PAYOUT_ORG_LIST_COPY.emptyDescription }}
      columns={[
        { key: "name", label: PAYOUT_ORG_LIST_COPY.shop, cell: (org) => org.name, phone: "title" },
        { key: "code", label: PAYOUT_ORG_LIST_COPY.code, cell: (org) => <span className="font-mono">{org.code}</span>, phone: "meta" },
        { key: "commission", label: PAYOUT_ORG_LIST_COPY.commission, cell: (org) => `${bpsToPercent(org.commissionBps)}%`, phone: "hidden" },
        { key: "entries", label: PAYOUT_ORG_LIST_COPY.entries, cell: (org) => formatCount(org.entryCount), align: "end", phone: "hidden" },
        {
          key: "belowCost",
          label: PAYOUT_ORG_LIST_COPY.belowCost,
          cell: (org) =>
            org.negativeMarginOrders > 0 ? <StatusBadge tone="warning">{PAYOUT_ORG_LIST_COPY.belowCostCount(org.negativeMarginOrders)}</StatusBadge> : null,
          phone: "status",
        },
        { key: "owed", label: PAYOUT_ORG_LIST_COPY.owed, cell: (org) => <Money paise={org.owedPaise} />, align: "end", phone: "trailing" },
        { key: "unclaimed", label: PAYOUT_ORG_LIST_COPY.unclaimed, cell: (org) => <Money paise={org.unclaimedPaise} tone="muted" />, align: "end", phone: "meta" },
      ]}
    />
  );
}
