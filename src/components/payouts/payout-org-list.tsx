"use client";

import { ResourceList } from "@/components/shared/resource-list";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { Money } from "@/components/shared/Money";
import { bpsToPercent, formatCount } from "@/lib/format";
import type { payoutsDAL } from "@/data-access-layer/payouts.dal";

type PayoutOrgRow = Awaited<ReturnType<typeof payoutsDAL.overview>>["orgs"][number];

/** Every shop's two balances, never merged into one number; a row opens the shop's ledger. */
export function PayoutOrgList({ orgs }: { orgs: PayoutOrgRow[] }) {
  return (
    <ResourceList
      label="Shops and what they are owed"
      rows={orgs}
      rowKey={(org) => org.id}
      rowHref={(org) => `/admin/payouts/${org.id}`}
      empty={{ title: "No shops yet", description: "A shop appears here once it has terms and its first sale." }}
      columns={[
        { key: "name", label: "Shop", cell: (org) => org.name, phone: "title" },
        { key: "code", label: "Code", cell: (org) => <span className="font-mono">{org.code}</span>, phone: "meta" },
        { key: "commission", label: "Commission", cell: (org) => `${bpsToPercent(org.commissionBps)}%`, phone: "hidden" },
        { key: "entries", label: "Entries", cell: (org) => formatCount(org.entryCount), align: "end", phone: "hidden" },
        {
          key: "belowCost",
          label: "Below cost",
          cell: (org) =>
            org.negativeMarginOrders > 0 ? <StatusBadge tone="warning">{org.negativeMarginOrders} below cost</StatusBadge> : null,
          phone: "status",
        },
        { key: "owed", label: "Owed", cell: (org) => <Money paise={org.owedPaise} />, align: "end", phone: "trailing" },
        { key: "unclaimed", label: "Unclaimed", cell: (org) => <Money paise={org.unclaimedPaise} tone="muted" />, align: "end", phone: "meta" },
      ]}
    />
  );
}
