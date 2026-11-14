"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { LockedAction } from "@/components/subscriptions/locked-action";
import { useMutation } from "@/hooks/core/useMutation";
import type { MarketplaceChannel } from "@server/channels/channel-connection.types";
import { STOCK_SYNC, type StockSyncState } from "@server/channels/channel-stock.types";

import { channelsApiClient } from "./channelsApiClient";
import { STOCK } from "./stock-copy";
import { FEATURE } from "@/components/subscriptions/features";

/**
 * Pause on the Channels card, and Turn back on once paused (inventory-sync Q28). Sync starts by itself
 * on connecting, so this is for exceptions, kept off the daily Listings screen.
 */
export function StockSyncActions({ orgId, channel, label, state }: { orgId: string; channel: MarketplaceChannel; label: string; state: StockSyncState }) {
  const router = useRouter();
  const paused = state === STOCK_SYNC.PAUSED;
  const change = useMutation(() => channelsApiClient.changeStockSync(orgId, channel, { action: paused ? "on" : "pause" }), {
    showToast: false,
    onSuccess: () => {
      toast.success(paused ? STOCK.onToast(label) : STOCK.pausedToast(label));
      router.refresh();
    },
    onError: (error) => toast.error(error.message || STOCK.failed),
  });
  if (state === STOCK_SYNC.OFF) return null;
  const button = (
    <Button variant="outline" className="min-h-10 w-full md:w-auto" aria-busy={change.isLoading} onClick={() => void change.mutate().catch(() => undefined)}>
      {paused ? STOCK.turnBackOn : STOCK.pause}
    </Button>
  );
  // Pausing never locks; turning sync back on is part of Channels (feature-access D5).
  if (!paused) return button;
  return (
    <LockedAction feature={FEATURE.CHANNELS} label={STOCK.turnBackOn} variant="outline" className="min-h-10 w-full md:w-auto">
      {button}
    </LockedAction>
  );
}
