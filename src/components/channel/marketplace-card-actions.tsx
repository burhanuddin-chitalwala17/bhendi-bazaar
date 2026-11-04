"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useMutation } from "@/hooks/core/useMutation";
import { CARD_STATE, type CardState, type MarketplaceChannel } from "@server/channels/channel-connection.types";
import type { StockSyncState } from "@server/channels/channel-stock.types";

import { channelsApiClient } from "./channelsApiClient";
import { ACTION, CARD, CHECK_RESULT } from "./channel-copy";
import { DisconnectDialog } from "./disconnect-dialog";
import { StockSyncActions } from "./stock-sync-actions";

interface MarketplaceCardActionsProps {
  orgId: string;
  channel: MarketplaceChannel;
  label: string;
  state: CardState;
  stale: boolean;
  stockSync: StockSyncState | null;
}

/**
 * The card's one primary action, per ux.md. Never disabled: an action that cannot happen explains
 * itself on tap (ADR-0053). Connect, Renew and Reconnect are links the browser follows.
 */
export function MarketplaceCardActions({ orgId, channel, label, state, stale, stockSync }: MarketplaceCardActionsProps) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const [slow, setSlow] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  useEffect(() => {
    if (!opening) return;
    const timer = setTimeout(() => setSlow(true), 3000);
    return () => clearTimeout(timer);
  }, [opening]);

  const check = useMutation(() => channelsApiClient.checkNow(orgId, channel), {
    showToast: false,
    onSuccess: ({ result }) => {
      if (result === "ok") toast.success(CHECK_RESULT.ok);
      else if (result === "needs_reconnect") toast.error(CHECK_RESULT.needs_reconnect);
      else toast.error(CHECK_RESULT.unreachable(label));
      router.refresh();
    },
    onError: () => toast.error(CHECK_RESULT.unreachable(label)),
  });

  const href = channelsApiClient.connectUrl(orgId, channel);
  const goTo = (text: string, variant: "default" | "outline" = "default") => (
    <Button asChild variant={variant} className="min-h-10 w-full md:w-auto">
      <a href={href} onClick={() => setOpening(true)} aria-busy={opening}>
        {opening ? (
          <>
            <Spinner />
            {ACTION.connecting(label)}
            {slow ? ` ${ACTION.stillWorking}` : ""}
          </>
        ) : (
          text
        )}
      </a>
    </Button>
  );

  // Pause sits beside Disconnect (inventory-sync Q28): sync runs by itself, so stopping it is the exception.
  const pauseControl = stockSync ? <StockSyncActions orgId={orgId} channel={channel} label={label} state={stockSync} /> : null;

  // Secondary on the states where a reconnect can return a different account: switching is
  // disconnect, then connect (decision Q8), so the way out must be on the card.
  const disconnectControl = (
    <>
      <Button
        variant="ghost"
        className="min-h-10 self-end text-destructive hover:text-destructive md:ml-auto"
        onClick={() => setDisconnectOpen(true)}
      >
        {ACTION.disconnect}
      </Button>
      <DisconnectDialog orgId={orgId} channel={channel} label={label} open={disconnectOpen} onOpenChange={setDisconnectOpen} />
    </>
  );

  switch (state) {
    case CARD_STATE.NOT_CONNECTED:
      return goTo(ACTION.connect(label));
    case CARD_STATE.RENEWAL_DUE:
      return (
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          {goTo(ACTION.renewNow)}
          {pauseControl}
          {disconnectControl}
        </div>
      );
    case CARD_STATE.NEEDS_RECONNECT:
      return (
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          {goTo(ACTION.reconnect)}
          {disconnectControl}
        </div>
      );
    case CARD_STATE.UNAVAILABLE:
      return (
        <Button variant="outline" className="min-h-10 w-full md:w-auto" onClick={() => toast.info(CARD.unavailable(label))}>
          {ACTION.tellMeMore}
        </Button>
      );
    case CARD_STATE.FULL:
      return (
        <Button variant="outline" className="min-h-10 w-full md:w-auto" onClick={() => toast.info(CARD.full(label))}>
          {ACTION.why}
        </Button>
      );
    case CARD_STATE.CONNECTED:
      return (
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          {stale && (
            <Button
              variant="outline"
              className="min-h-10 w-full md:w-auto"
              onClick={() => void check.mutate().catch(() => undefined)}
              pending={check.isLoading}
            >
              {ACTION.checkNow}
            </Button>
          )}
          {pauseControl}
          {disconnectControl}
        </div>
      );
    default:
      return null;
  }
}
