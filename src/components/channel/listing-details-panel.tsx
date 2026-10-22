"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ChannelListingDetailDTO, MarketplaceChannel } from "@server/channels/channel-connection.types";

import { ListingImage } from "./listing-image";
import { ListingLinkAction } from "./listing-link-action";
import { ListingSettleActions } from "./listing-settle-actions";
import { ID_NAME, PANEL, ROW, STATUS_TEXT } from "./listing-copy";

interface ListingDetailsPanelProps {
  orgId: string;
  channel: MarketplaceChannel;
  label: string;
  detail: ChannelListingDetailDTO;
  /** The page without `?listing=`, where closing returns. */
  closeHref: string;
}

type Value = string | null;

/**
 * What the marketplace says beside what Bhendi Bazaar has (Q17, ux.md "Listing details panel").
 * Read-only; opened by the URL so a product's "See listing" can land on it.
 */
export function ListingDetailsPanel({ orgId, channel, label, detail, closeHref }: ListingDetailsPanelProps) {
  const router = useRouter();
  const { listing, product, linkBackTo } = detail;
  const close = () => router.replace(closeHref, { scroll: false });

  const theirs: Record<"title" | "sku" | "status" | "price" | "stock", Value> = {
    title: listing.title,
    sku: listing.sku,
    status: listing.status ? STATUS_TEXT[listing.status] : null,
    price: listing.pricePaise !== null ? formatCurrency(listing.pricePaise) : null,
    stock: listing.quantity !== null ? String(listing.quantity) : null,
  };
  const ours = product
    ? {
        title: product.name,
        sku: product.sku,
        status: product.archived ? PANEL.archived : null,
        price: formatCurrency(product.pricePaise),
        stock: String(product.stock),
      }
    : null;
  // Status words differ by design (Live vs nothing); only compare what both sides state.
  const differs = (key: keyof typeof theirs) =>
    ours !== null && key !== "status" && theirs[key] !== null && ours[key] !== null && theirs[key]?.trim().toLowerCase() !== ours[key]?.trim().toLowerCase();
  const anyDifference = (["title", "sku", "price", "stock"] as const).some(differs);

  return (
    <Sheet open onOpenChange={(open) => !open && close()}>
      <SheetContent side="adaptive" className="md:max-w-xl">
        <SheetTitle className="leading-snug">{listing.title ?? listing.sku}</SheetTitle>
        <SheetDescription>{ROW.skuLine(listing.sku, ID_NAME[channel], listing.externalId)}</SheetDescription>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Column heading={PANEL.on(label)} muted={listing.gone} note={listing.gone ? ROW.gone(label) : null}>
            <ListingImage url={listing.imageUrl} title={listing.title} size={96} />
            {(Object.keys(theirs) as Array<keyof typeof theirs>).map((key) => (
              <Field key={key} name={PANEL[key]} value={theirs[key]} different={differs(key)} />
            ))}
          </Column>
          <Column heading={PANEL.onBb}>
            {ours && product ? (
              <>
                <ListingImage url={product.imageUrl} title={product.name} size={96} ours />
                {(Object.keys(ours) as Array<keyof typeof ours>).map((key) => (
                  <Field key={key} name={PANEL[key]} value={ours[key]} different={differs(key)} />
                ))}
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">{PANEL.notOnBb}</p>
                {linkBackTo && <p className="text-sm">{PANEL.wasLinkedTo(linkBackTo.name)}</p>}
              </>
            )}
          </Column>
        </div>

        {product && (
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <p>{PANEL.changesNothing}</p>
            {anyDifference && <p>{PANEL.settledLater(label)}</p>}
          </div>
        )}

        <div className="mt-auto flex flex-col-reverse gap-2 pt-2 md:flex-row md:justify-end">
          <Button variant="ghost" className="min-h-10" onClick={close}>
            {PANEL.close}
          </Button>
          {!listing.gone && product && (
            <ListingLinkAction orgId={orgId} channel={channel} listingId={listing.id} kind="unlink" />
          )}
          {!listing.gone && !product && listing.unlinkedByOwner && linkBackTo && !listing.leftOff && (
            <ListingLinkAction orgId={orgId} channel={channel} listingId={listing.id} kind="linkBack" />
          )}
          {listing.leftOff && <ListingLinkAction orgId={orgId} channel={channel} listingId={listing.id} kind="bringBack" />}
        </div>
        {!product && !listing.leftOff && (
          <ListingSettleActions orgId={orgId} channel={channel} label={label} listingId={listing.id} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function Column({ heading, muted, note, children }: { heading: string; muted?: boolean; note?: string | null; children: ReactNode }) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-2 rounded-card border p-3", muted && "opacity-60")}>
      <h3 className="text-sm font-semibold">{heading}</h3>
      {note && <p className="text-xs font-medium text-muted-foreground">{note}</p>}
      {children}
    </section>
  );
}

function Field({ name, value, different }: { name: string; value: Value; different: boolean }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="text-xs text-muted-foreground">{name}</span>
      <span className="break-words text-sm">
        {value ?? PANEL.none}
        {different && <span className="ml-2 text-xs font-semibold text-warning">{PANEL.different}</span>}
      </span>
    </div>
  );
}
