import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { ProductMarketplaceLinkDTO } from "@server/channels/channel-connection.types";
import type { ProductListingSummaryDTO } from "@server/channels/platform-listing.types";
import { ListingStatusLine } from "./listing-status-line";
import { CREATE, LISTING } from "./platform-listing-copy";

import { ID_NAME, ON_MARKETPLACES, STATUS_TEXT, ago, priceAndStock } from "./listing-copy";
import { PRODUCT_STOCK } from "./stock-copy";
import { RetryPhotosButton } from "./retry-photos-button";
import { PRODUCT_PHOTOS } from "./settle-copy";
import { LINK_SOURCE } from "@server/channels/channel-connection.types";

/**
 * Where this product is linked on each connected marketplace, read-only (channel-import Q19, ux.md
 * "Product editor: On marketplaces"). Not shown when no marketplace is connected.
 */
export function ProductMarketplaces({
  orgId,
  productId,
  links,
  summaries,
}: {
  orgId: string;
  productId: string;
  links: ProductMarketplaceLinkDTO[];
  summaries: ProductListingSummaryDTO[];
}) {
  if (links.length === 0) return null;
  return (
    <section className="flex flex-col gap-3 rounded-card border bg-card p-4 text-card-foreground">
      <h2 className="text-base font-semibold">{ON_MARKETPLACES.title}</h2>
      <ul className="flex flex-col gap-3">
        {links.map((link) => {
          const summary = summaries.find((s) => s.channel === link.channel);
          const listingHref = `/org/${orgId}/products/${productId}/listings/${link.channel}`;
          return (
          <li key={link.channel} className="flex flex-col gap-2 text-sm md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 flex-col gap-1">
              <p className="flex flex-wrap gap-x-2">
                <span className="font-medium">{link.label}</span>
                <span className="text-muted-foreground">·</span>
                <Summary link={link} />
              </p>
              {link.listing && link.needsReconnect && (
                <p className="text-xs font-medium text-warning">{ON_MARKETPLACES.needsReconnect(link.label)}</p>
              )}
              {link.listing?.photos && <PhotoLine link={link} />}
              {link.listing?.stock && !link.listing.gone && <StockLine stock={link.listing.stock} label={link.label} />}
              {summary?.status && (
                <div>
                  <ListingStatusLine status={summary.status} label={link.label} />
                </div>
              )}
              {!summary?.status && !link.listing && summary && !summary.canCreate && (
                <p className="text-xs text-muted-foreground">{CREATE.flipkartHow}</p>
              )}
            </div>
            {summary?.status && (
              <Button asChild size="sm" variant={summary.status.waiting > 0 ? "default" : "outline"} className="min-h-10 self-start md:self-auto">
                <Link href={listingHref}>{LISTING.edit(link.label)}</Link>
              </Button>
            )}
            {!summary?.status && !link.listing && summary?.canCreate && (
              <Button asChild size="sm" className="min-h-10 self-start md:self-auto">
                <Link href={`${listingHref}/new`}>{CREATE.putOn(link.label)}</Link>
              </Button>
            )}
            {link.listing && (
              <div className="flex flex-wrap gap-2">
                {link.listing.photos && link.listing.photos.failed > 0 && link.listing.photos.done + link.listing.photos.failed >= link.listing.photos.total && (
                  <RetryPhotosButton orgId={orgId} channel={link.channel} listingId={link.listing.id} />
                )}
                {link.needsReconnect && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/org/${orgId}/channels`}>{ON_MARKETPLACES.goToChannels}</Link>
                  </Button>
                )}
                {link.listing.stock?.oversold && (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/org/${orgId}/orders?tab=marketplace`}>{PRODUCT_STOCK.seeOrder}</Link>
                  </Button>
                )}
                <Button asChild variant="outline" size="sm">
                  <Link href={`/org/${orgId}/channels/${link.channel}/listings?tab=linked&listing=${link.listing.id}`}>
                    {ON_MARKETPLACES.seeListing}
                  </Link>
                </Button>
              </div>
            )}
          </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Stock sync's line for one marketplace (inventory-sync ux.md): sent, sending, or oversold. */
function StockLine({ stock, label }: { stock: NonNullable<NonNullable<ProductMarketplaceLinkDTO["listing"]>["stock"]>; label: string }) {
  if (stock.oversold) return <p className="text-xs font-medium text-destructive">{PRODUCT_STOCK.oversold(label)}</p>;
  if (stock.heldByMarketplace) return <p className="text-xs text-muted-foreground">{PRODUCT_STOCK.held(label)}</p>;
  if (stock.sent === null || !stock.sentAt) return <p className="text-xs text-muted-foreground">{PRODUCT_STOCK.sending}</p>;
  return <p className="text-xs text-muted-foreground">{PRODUCT_STOCK.sent(stock.sent, ago(stock.sentAt, Date.now()))}</p>;
}

/** Photos copying onto the product, or some that failed (product-merge ux.md "product and card"). */
function PhotoLine({ link }: { link: ProductMarketplaceLinkDTO }) {
  const photos = link.listing?.photos;
  if (!photos || photos.total === 0) return null;
  if (photos.done + photos.failed < photos.total) {
    return <p className="text-xs text-muted-foreground">{PRODUCT_PHOTOS.copying(photos.total, link.label)}</p>;
  }
  if (photos.failed === 0) return null;
  return <p className="text-xs font-medium text-warning">{PRODUCT_PHOTOS.partly(photos.failed, photos.total, link.label)}</p>;
}

function Summary({ link }: { link: ProductMarketplaceLinkDTO }) {
  const listing = link.listing;
  if (!listing) return <span className="text-muted-foreground">{ON_MARKETPLACES.notLinked}</span>;
  if (listing.gone) return <span className="text-muted-foreground">{ON_MARKETPLACES.gone(link.label)}</span>;
  const parts = [
    listing.externalId ? `${ID_NAME[link.channel]} ${listing.externalId}` : null,
    listing.status ? STATUS_TEXT[listing.status] : null,
    priceAndStock(listing.pricePaise, listing.quantity),
  ].filter((part): part is string => part !== null);
  return (
    <>
      <span className="text-success">
        {listing.linkSource === LINK_SOURCE.OWNER ? PRODUCT_PHOTOS.linkedByYou : ON_MARKETPLACES.linkedBySku}
      </span>
      {parts.map((part) => (
        <span key={part} className="flex gap-x-2">
          <span className="text-muted-foreground">·</span>
          <span className="tabular-nums">{part}</span>
        </span>
      ))}
    </>
  );
}
