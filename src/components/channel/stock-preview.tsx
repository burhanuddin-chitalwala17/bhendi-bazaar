"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useMutation } from "@/hooks/core/useMutation";
import type { LocationMatchDTO, StockPreviewDTO } from "@server/channels/channel-stock.types";

import { channelsApiClient } from "./channelsApiClient";
import { LocationMatchSheet } from "./location-match-sheet";
import { PREVIEW, STOCK } from "./stock-copy";

const SHOWN = 20;

/** The turn-on preview (inventory-sync ux.md, Q4): what will change, then the one confirmation. */
export function StockPreview({ orgId, preview, locations, backHref }: { orgId: string; preview: StockPreviewDTO; locations: LocationMatchDTO; backHref: string }) {
  const router = useRouter();
  const [all, setAll] = useState(false);
  const l = preview.label;
  const send = useMutation(() => channelsApiClient.changeStockSync(orgId, preview.channel, { action: "on" }), {
    showToast: false,
    onSuccess: () => {
      toast.success(PREVIEW.sent(l));
      router.push(backHref);
    },
    onError: (error) => toast.error(error.message || STOCK.failed),
  });
  const rows = all ? preview.rows : preview.rows.slice(0, SHOWN);
  // No counts are read until every location is matched: the match is the only step here.
  if (preview.locationsToMatch) {
    return (
      <div className="flex flex-col gap-3 rounded-card border border-warning bg-warning/10 p-4">
        <p className="font-medium">{preview.locationsRead ? PREVIEW.matchFirst : STOCK.readingLocations(l)}</p>
        {preview.locationsRead && (
          <>
            <p className="text-sm text-muted-foreground">{PREVIEW.matchFirstHint(l)}</p>
            <LocationMatchSheet orgId={orgId} match={locations} trigger={<Button className="min-h-10 self-start">{STOCK.matchLocations}</Button>} />
          </>
        )}
        <Button asChild variant="outline" className="min-h-10 self-start">
          <Link href={backHref}>{PREVIEW.notNow}</Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4 pb-24 md:pb-6">
      {preview.toZero > 0 && <p className="rounded-card border border-warning bg-warning/10 p-3 text-sm font-medium">{PREVIEW.toZero(preview.toZero, l)}</p>}
      <p className="font-medium">{preview.changing > 0 ? PREVIEW.summary(preview.changing, preview.matching) : PREVIEW.none(preview.matching)}</p>
      {preview.unread > 0 && <p className="text-sm text-muted-foreground">{PREVIEW.unread(preview.unread, l)}</p>}
      {preview.rows.length > 0 && (
        <ul className="rounded-card border bg-card px-4">
          {rows.map((r) => (
            <li key={r.listingId} className="flex justify-between gap-3 border-b py-3 text-sm last:border-b-0">
              <span className="min-w-0">
                {r.title}
                {r.archived && <span className="text-muted-foreground"> · {PREVIEW.archived}</span>}
                {r.heldByMarketplace && <span className="text-muted-foreground"> · {PREVIEW.held(l)}</span>}
                {r.toZero && <span className="font-medium text-warning"> · {PREVIEW.outOfStock}</span>}
              </span>
              {!r.heldByMarketplace && <span className="whitespace-nowrap font-semibold tabular-nums">{PREVIEW.row(l, r.theirs, r.ours)}</span>}
            </li>
          ))}
        </ul>
      )}
      {preview.rows.length > SHOWN && !all && (
        <Button variant="ghost" size="sm" className="min-h-10 self-start" onClick={() => setAll(true)}>
          {PREVIEW.showAll}
        </Button>
      )}
      <div className="fixed inset-x-0 bottom-tabbar z-10 flex gap-2 border-t bg-card p-3 md:static md:border-0 md:bg-transparent md:p-0">
        <Button className="min-h-10 flex-1 md:flex-none" aria-busy={send.isLoading} onClick={() => void send.mutate().catch(() => undefined)}>
          {preview.changing > 0 ? PREVIEW.send(l) : STOCK.turnOn}
        </Button>
        <Button asChild variant="outline" className="min-h-10">
          <Link href={backHref}>{PREVIEW.notNow}</Link>
        </Button>
      </div>
    </div>
  );
}
