import Link from "next/link";

import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { cn } from "@/lib/utils";
import { LISTING_STATUS, type ChannelListingDTO, type MarketplaceChannel } from "@server/channels/channel-connection.types";

import { ListingImage } from "./listing-image";
import { ListingLinkAction } from "./listing-link-action";
import { ID_NAME, ROW, STATUS_TEXT, priceAndStock } from "./listing-copy";

interface ListingRowProps {
  orgId: string;
  channel: MarketplaceChannel;
  label: string;
  listing: ChannelListingDTO;
  /** Opens the details panel: the same page with `?listing=<id>`. */
  href: string;
  indented?: boolean;
}

/**
 * One marketplace listing (ux.md "State matrix — Listing row"). Rendered on the server; a tap opens
 * the details panel through the URL, and the one action is a client leaf.
 */
export function ListingRow({ orgId, channel, label, listing, href, indented }: ListingRowProps) {
  const money = priceAndStock(listing.pricePaise, listing.quantity);
  const status = listing.status ? STATUS_TEXT[listing.status] : null;

  return (
    <li
      className={cn(
        "flex items-start gap-3 border-b py-3 last:border-b-0",
        indented && "pl-6",
        listing.gone && "opacity-60",
      )}
    >
      <Link href={href} scroll={false} className="flex min-w-0 flex-1 items-start gap-3 rounded-field md:items-center">
        <ListingImage url={listing.imageUrl} title={listing.title} />
        <div className="flex min-w-0 flex-1 flex-col gap-1 md:flex-row md:items-center md:gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="line-clamp-2 text-sm font-medium">{listing.title ?? listing.sku}</p>
            <p className="truncate text-xs text-muted-foreground">
              {ROW.skuLine(listing.sku, ID_NAME[channel], listing.externalId)}
            </p>
            <LinkLine listing={listing} label={label} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground md:w-40 md:flex-col md:items-end md:gap-1 lg:w-48">
            {status && (
              <StatusBadge status={listing.status === LISTING_STATUS.LIVE ? "connected" : "muted"}>{status}</StatusBadge>
            )}
            {money && <span className="tabular-nums">{money}</span>}
          </div>
        </div>
      </Link>
      {!listing.gone && listing.product && (
        <ListingLinkAction orgId={orgId} channel={channel} listingId={listing.id} kind="unlink" />
      )}
      {!listing.gone && !listing.product && listing.unlinkedByOwner && (
        <ListingLinkAction orgId={orgId} channel={channel} listingId={listing.id} kind="linkBack" />
      )}
    </li>
  );
}

function LinkLine({ listing, label }: { listing: ChannelListingDTO; label: string }) {
  if (listing.gone) return <p className="text-xs font-medium text-muted-foreground">{ROW.gone(label)}</p>;
  if (listing.product) {
    return (
      <p className="flex flex-wrap items-center gap-x-2 text-xs text-success">
        <span className="truncate">{ROW.linkedBySku(listing.product.name)}</span>
        {listing.product.archived && <span className="text-warning">{ROW.archivedHere}</span>}
      </p>
    );
  }
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
      <span>{ROW.notOnBb}</span>
      {listing.unlinkedByOwner && <span className="font-medium">{ROW.unlinkedByYou}</span>}
    </p>
  );
}
