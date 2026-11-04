"use client";

import Image from "next/image";

import { ResourceList } from "@/components/shared/resource-list";
import { formatCount, formatCurrency } from "@/lib/format";
import type { OrgBiddingSummary } from "@server/bidding/bidding.types";
import { BiddingPhaseBadge } from "./BiddingPhaseBadge";

type Row = OrgBiddingSummary & { orgName: string };

function outcome(event: Row): string {
  if (event.soldAmountPaise !== null) return `Sold for ${formatCurrency(event.soldAmountPaise)}`;
  if (event.highestBidPaise !== null) return `Highest ${formatCurrency(event.highestBidPaise)}`;
  return "No bids";
}

/** Every auction on the platform; a row opens its bidders and, once closed, its outcome. */
export function AdminBiddingList({ events }: { events: Row[] }) {
  return (
    <ResourceList
      label="Auctions"
      rows={events}
      rowKey={(event) => event.id}
      rowHref={(event) => `/admin/bidding/${event.id}`}
      thumbnail={(event) => (
        <Image src={event.product.thumbnail} alt="" width={44} height={44} className="size-11 shrink-0 rounded-field object-cover" />
      )}
      empty={{ title: "No auctions yet", description: "No shop has put anything up for bidding yet." }}
      columns={[
        { key: "product", label: "Item", cell: (event) => event.product.name, phone: "title" },
        { key: "shop", label: "Shop", cell: (event) => event.orgName, phone: "meta" },
        { key: "bids", label: "Bids", cell: (event) => formatCount(event.bidCount), align: "end", phone: "meta" },
        { key: "outcome", label: "Outcome", cell: outcome, phone: "meta" },
        { key: "phase", label: "Status", cell: (event) => <BiddingPhaseBadge phase={event.phase} />, phone: "status" },
      ]}
    />
  );
}
