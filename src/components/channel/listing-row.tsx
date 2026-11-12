import Link from "next/link";

import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { cn } from "@/lib/utils";
import {
  LINK_SOURCE,
  LISTING_STATUS,
  SUGGESTION_KIND,
  type ChannelListingDTO,
  type MarketplaceChannel,
} from "@server/channels/channel-connection.types";

import { ListingImage } from "./listing-image";
import { ListingLinkAction } from "./listing-link-action";
import { ID_NAME, ROW, STATUS_TEXT, priceAndStock } from "./listing-copy";
import { LISTINGS_SETTLE } from "./settle-copy";
import { AskAdminPicker } from "./ask-admin-picker";
import { ASK_ADMIN } from "./facts-copy";
import { PROBLEMS } from "./platform-listing-copy";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@server/shared/routes";
import { withFrom } from "@/lib/safe-callback-url";

interface ListingRowProps {
  orgId: string;
  /** For the message a parked listing asks the admin with (marketplace-facts Q13). */
  shopName: string;
  channel: MarketplaceChannel;
  label: string;
  listing: ChannelListingDTO;
  /** Opens the details panel: the same page with `?listing=<id>`. */
  href: string;
  /** This Listings page as it stands, so Fix's screen can come back to it (navigation-flows R4). */
  from?: string;
  indented?: boolean;
}

/**
 * One marketplace listing (ux.md "State matrix — Listing row"). Rendered on the server; a tap opens
 * the details panel through the URL, and the one action is a client leaf.
 */
export function ListingRow({ orgId, shopName, channel, label, listing, href, from, indented }: ListingRowProps) {
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
            {listing.problems && (
              <p className="line-clamp-2 text-xs font-medium text-warning">{PROBLEMS.line(label, listing.problems.first, listing.problems.count - 1)}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground md:w-40 md:flex-col md:items-end md:gap-1 lg:w-48">
            {listing.problems ? (
              <StatusBadge tone={listing.problems.suppressed ? "destructive" : "warning"}>
                {listing.problems.suppressed ? PROBLEMS.suppressed : PROBLEMS.needsFix}
              </StatusBadge>
            ) : (
              status && <StatusBadge tone={listing.status === LISTING_STATUS.LIVE ? "success" : "neutral"}>{status}</StatusBadge>
            )}
            {money && <span className="tabular-nums">{money}</span>}
          </div>
        </div>
      </Link>
      {/* The fix is the listing screen's: the reason on its field, then Review and publish (Q23). */}
      {!listing.gone && listing.product && listing.problems && (
        <Button asChild size="sm" className="min-h-10">
          <Link href={from ? withFrom(ROUTES.org.productListing(orgId, listing.product.id, channel), from) : ROUTES.org.productListing(orgId, listing.product.id, channel)}>{PROBLEMS.fix}</Link>
        </Button>
      )}
      {!listing.gone && listing.product && (
        <ListingLinkAction orgId={orgId} channel={channel} listingId={listing.id} kind="unlink" />
      )}
      {!listing.gone && !listing.product && listing.unlinkedByOwner && !listing.leftOff && (
        <ListingLinkAction orgId={orgId} channel={channel} listingId={listing.id} kind="linkBack" />
      )}
      {listing.waitingForType && (
        <AskAdminPicker
          message={ASK_ADMIN.message(shopName, label, listing.title ?? listing.sku, listing.sku, listing.waitingForType.marketplaceType)}
        />
      )}
      {listing.leftOff && <ListingLinkAction orgId={orgId} channel={channel} listingId={listing.id} kind="bringBack" />}
    </li>
  );
}

function LinkLine({ listing, label }: { listing: ChannelListingDTO; label: string }) {
  if (listing.gone) return <p className="text-xs font-medium text-muted-foreground">{ROW.gone(label)}</p>;
  if (listing.product) {
    return (
      <p className="flex flex-wrap items-center gap-x-2 text-xs text-success">
        <span className="truncate">
          {listing.linkSource === LINK_SOURCE.OWNER
            ? LISTINGS_SETTLE.linkedByYou(listing.product.name)
            : ROW.linkedBySku(listing.product.name)}
        </span>
        {listing.product.archived && <span className="text-warning">{ROW.archivedHere}</span>}
      </p>
    );
  }
  if (listing.waitingForType) return <p className="text-xs font-medium text-warning">{ASK_ADMIN.parked}</p>;
  if (listing.leftOff) return <p className="text-xs font-medium text-muted-foreground">{LISTINGS_SETTLE.leftOffByYou}</p>;
  return (
    <>
      <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        <span>{ROW.notOnBb}</span>
        {listing.unlinkedByOwner && <span className="font-medium">{ROW.unlinkedByYou}</span>}
      </p>
      {listing.suggestion && (
        <p className="truncate text-xs font-medium text-warning">
          {listing.suggestion.kind === SUGGESTION_KIND.SAME_SKU
            ? LISTINGS_SETTLE.sameSku(listing.suggestion.text)
            : LISTINGS_SETTLE.looksLike(listing.suggestion.text)}
        </p>
      )}
    </>
  );
}
