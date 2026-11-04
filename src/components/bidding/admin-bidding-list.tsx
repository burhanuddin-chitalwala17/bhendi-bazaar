"use client";

import Image from "next/image";

import { ResourceList } from "@/components/shared/resource-list";
import { formatCount, formatCurrency } from "@/lib/format";
import type { OrgBiddingSummary } from "@server/bidding/bidding.types";
import { BiddingPhaseBadge } from "./BiddingPhaseBadge";
import { ADMIN_BIDDING_LIST_COPY } from "./bidding-copy";
import { ROUTES } from "@server/shared/routes";

type Row = OrgBiddingSummary & { orgName: string };

function outcome(event: Row): string {
  if (event.soldAmountPaise !== null) return `Sold for ${formatCurrency(event.soldAmountPaise)}`;
  if (event.highestBidPaise !== null) return `Highest ${formatCurrency(event.highestBidPaise)}`;
  return ADMIN_BIDDING_LIST_COPY.noBids;
}

/** Every auction on the platform; a row opens its bidders and, once closed, its outcome. */
export function AdminBiddingList({ events }: { events: Row[] }) {
  return (
    <ResourceList
      label={ADMIN_BIDDING_LIST_COPY.auctions}
      rows={events}
      rowKey={(event) => event.id}
      rowHref={(event) => ROUTES.admin.auction(event.id)}
      thumbnail={(event) => (
        <Image src={event.product.thumbnail} alt="" width={44} height={44} className="size-11 shrink-0 rounded-field object-cover" />
      )}
      empty={{ title: ADMIN_BIDDING_LIST_COPY.noAuctionsYet, description: ADMIN_BIDDING_LIST_COPY.noShopHasPut }}
      columns={[
        { key: "product", label: ADMIN_BIDDING_LIST_COPY.item, cell: (event) => event.product.name, phone: "title" },
        { key: "shop", label: ADMIN_BIDDING_LIST_COPY.shop, cell: (event) => event.orgName, phone: "meta" },
        { key: "bids", label: ADMIN_BIDDING_LIST_COPY.bids, cell: (event) => formatCount(event.bidCount), align: "end", phone: "meta" },
        { key: "outcome", label: ADMIN_BIDDING_LIST_COPY.outcome, cell: outcome, phone: "meta" },
        { key: "phase", label: ADMIN_BIDDING_LIST_COPY.status, cell: (event) => <BiddingPhaseBadge phase={event.phase} />, phone: "status" },
      ]}
    />
  );
}
