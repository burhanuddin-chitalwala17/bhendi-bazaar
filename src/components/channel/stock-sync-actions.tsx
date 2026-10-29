"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useMutation } from "@/hooks/core/useMutation";
import type { MarketplaceChannel } from "@server/channels/channel-connection.types";
import { STOCK_SYNC, type StockSyncState } from "@server/channels/channel-stock.types";

import { channelsApiClient } from "./channelsApiClient";
import { PREVIEW, STOCK } from "./stock-copy";

/** The section's one action: turn on (through the preview), pause, or turn back on (inventory-sync Q4). */
export function StockSyncActions({ orgId, channel, label, state }: { orgId: string; channel: MarketplaceChannel; label: string; state: StockSyncState }) {
  const router = useRouter();
  const pause = useMutation(() => channelsApiClient.changeStockSync(orgId, channel, { action: "pause" }), {
    showToast: false,
    onSuccess: () => {
      toast.success(PREVIEW.pausedToast(label));
      router.refresh();
    },
    onError: () => toast.error(STOCK.failed),
  });
  if (state === STOCK_SYNC.ON) {
    return (
      <Button variant="outline" size="sm" className="min-h-10 self-start" aria-busy={pause.isLoading} onClick={() => void pause.mutate().catch(() => undefined)}>
        {STOCK.pause}
      </Button>
    );
  }
  return (
    <Button asChild size="sm" variant={state === STOCK_SYNC.PAUSED ? "outline" : "default"} className="min-h-10 self-start">
      <Link href={`/org/${orgId}/channels/${channel}/stock-sync`}>{state === STOCK_SYNC.PAUSED ? STOCK.turnBackOn : STOCK.turnOn}</Link>
    </Button>
  );
}
