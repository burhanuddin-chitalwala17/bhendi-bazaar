"use client";

import { useState } from "react";
import Link from "next/link";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FAMILY_MAX_MEMBERS } from "@server/channels/channel-family.types";
import type { ChannelListingDTO } from "@server/channels/channel-connection.types";

import { GROUP } from "./family-copy";
import { ListingImage } from "./listing-image";

/**
 * "Group listings" (family-merge ux.md "Flipkart, picking by hand"): tick the listings that are one
 * item, then continue to the family page. Nothing is grouped until it is saved there.
 */
export function GroupPicker({ orgId, listings, cancelHref }: { orgId: string; listings: ChannelListingDTO[]; cancelHref: string }) {
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < FAMILY_MAX_MEMBERS ? [...p, id] : p));
  const open = listings.filter((l) => !l.product && !l.leftOff && !l.gone);
  return (
    <div className="flex flex-col gap-3 pb-24 md:pb-6">
      <p className="text-sm text-muted-foreground">{GROUP.pickHint}</p>
      <ul className="rounded-card border bg-card px-4">
        {open.map((l) => (
          <li key={l.id} className="flex items-center gap-3 border-b last:border-b-0">
            <ListingImage url={l.imageUrl} title={l.title} />
            <div className="min-w-0 flex-1">
              <Checkbox checked={picked.includes(l.id)} onChange={() => toggle(l.id)} label={l.title ?? l.sku} description={`SKU ${l.sku}`} />
            </div>
          </li>
        ))}
      </ul>
      <div className="fixed inset-x-0 bottom-tabbar z-10 flex items-center gap-2 border-t bg-card p-3 md:static md:border-0 md:bg-transparent md:p-0">
        <strong className="flex-1 text-sm">{GROUP.picked(picked.length)}</strong>
        <Button asChild variant="outline" className="min-h-10">
          <Link href={cancelHref}>{GROUP.cancel}</Link>
        </Button>
        {picked.length >= 2 ? (
          <Button asChild className="min-h-10">
            <Link href={`/org/${orgId}/channels/family?listings=${picked.join(",")}`}>{GROUP.continue}</Link>
          </Button>
        ) : (
          <Button className="min-h-10" onClick={() => toast.error(GROUP.pickTwo)}>
            {GROUP.continue}
          </Button>
        )}
      </div>
    </div>
  );
}
