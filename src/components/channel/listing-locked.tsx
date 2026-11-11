"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { HandoffSheet, HANDOFF_WIDE } from "@/components/shared/overlays/handoff-sheet";
import type { ListingScreenDTO } from "@server/channels/platform-listing.types";

import { GENERIC, LISTING, rupees } from "./platform-listing-copy";
import { ROUTES } from "@server/shared/routes";
import { withFrom } from "@/lib/safe-callback-url";

/**
 * "Same everywhere" (channel-listings Q10, parent Q28): strict fields shown, never editable here.
 * Each explains itself on tap and links to the product, rather than looking disabled.
 */
export function ListingLocked({ orgId, screen, from }: { orgId: string; screen: ListingScreenDTO; from?: string }) {
  const editHref = from ? withFrom(ROUTES.org.editProduct(orgId, screen.productId), from) : ROUTES.org.editProduct(orgId, screen.productId);
  const rows = [
    { key: "mrp", name: "MRP", value: screen.locked.mrpPaise !== null ? rupees(screen.locked.mrpPaise) : LISTING.none },
    { key: "barcode", name: "Barcode", value: screen.locked.barcode ?? LISTING.none },
    { key: "brand", name: "Brand", value: screen.generic ? GENERIC.value : (screen.locked.brand ?? LISTING.none) },
    { key: "stock", name: "Stock", value: LISTING.stock(screen.locked.stock) },
  ];
  return (
    <section className="flex flex-col gap-2 rounded-card border bg-card p-4">
      <h2 className="text-sm font-semibold">{LISTING.sameEverywhere}</h2>
      <ul className="flex flex-col">
        {rows.map((row) => (
          <li key={row.key}>
            <LockedRow editHref={editHref} name={row.name} value={row.value} />
          </li>
        ))}
      </ul>
      {screen.generic && (
        <p className="rounded-card bg-warning/10 p-3 text-small">
          {GENERIC.note(screen.label)}{" "}
          <Link href={ROUTES.org.listing(orgId)} className="underline underline-offset-4">{GENERIC.change}</Link>
        </p>
      )}
    </section>
  );
}

function LockedRow({ editHref, name, value }: { editHref: string; name: string; value: string }) {
  const [open, setOpen] = useState(false);
  return (
    <HandoffSheet
      open={open}
      onOpenChange={setOpen}
      wide={HANDOFF_WIDE.POPOVER}
      title={name}
      closeLabel="Close"
      description={LISTING.lockedWhy}
      trigger={
        <Button type="button" variant="ghost" className="h-auto min-h-10 w-full justify-between whitespace-normal px-0 text-left">
          <span className="text-sm text-muted-foreground">{name}</span>
          <span className="flex items-center gap-2 text-sm tabular-nums">
            {value}
            <Icon name="lock" size="xs" tone="muted" />
          </span>
        </Button>
      }
    >
      <Button asChild className="min-h-10 w-full">
        <Link href={editHref}>{LISTING.editProduct}</Link>
      </Button>
    </HandoffSheet>
  );
}
