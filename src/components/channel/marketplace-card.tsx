import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CARD_STATE, type ChannelCardDTO } from "@server/channels/channel-connection.types";
import { STOCK_SYNC } from "@server/channels/channel-stock.types";
import type { MarketplaceChannel } from "@server/channels/channel-connection.types";

import { ChannelCardShell } from "./channel-card-shell";
import { CARD, CHIP, MARKETPLACE_PITCH, PURPOSE, REASON, lastChecked } from "./channel-copy";
import { channelMark } from "./channel-mark";
import { ExpandableLine } from "./expandable-line";
import { LISTINGS, cardReadLine } from "./listing-copy";
import { MarketplaceCardActions } from "./marketplace-card-actions";
import { STOCK } from "./stock-copy";
import { ROUTES } from "@server/shared/routes";

const chipFor = (card: ChannelCardDTO) => {
  switch (card.state) {
    case CARD_STATE.CONNECTED:
      return { tone: "connected" as const, text: CHIP.connected };
    case CARD_STATE.RENEWAL_DUE:
      return { tone: "attention" as const, text: card.reapproveBy ? CHIP.renewBy(card.reapproveBy) : CHIP.connected };
    case CARD_STATE.NEEDS_RECONNECT:
      return { tone: "problem" as const, text: CHIP.needsReconnect };
    case CARD_STATE.UNAVAILABLE:
      return { tone: "attention" as const, text: CHIP.comingSoon };
    case CARD_STATE.FULL:
      return { tone: "attention" as const, text: CHIP.full };
    default:
      return { tone: "muted" as const, text: CHIP.notConnected };
  }
};

/** One marketplace (ux.md "State matrix — Marketplace card"). Renders on the server; the buttons are a leaf. */
export function MarketplaceCard({ orgId, card }: { orgId: string; card: ChannelCardDTO }) {
  const live = card.state === CARD_STATE.CONNECTED || card.state === CARD_STATE.RENEWAL_DUE;
  const reading = live ? cardReadLine(card.read, card.listings, card.label) : null;

  return (
    <ChannelCardShell
      label={card.label}
      purpose={PURPOSE[card.channel]}
      mark={channelMark(card.channel)}
      chip={chipFor(card)}
      actions={
        <>
          {live && (
            <Button asChild variant="link" className="min-h-10 px-0 md:mr-auto">
              <Link href={ROUTES.org.channelListings(orgId, card.channel)}>{LISTINGS.seeListings}</Link>
            </Button>
          )}
          <MarketplaceCardActions
            orgId={orgId}
            channel={card.channel as MarketplaceChannel}
            label={card.label}
            state={card.state}
            stale={card.stale}
            stockSync={card.stockSync}
          />
        </>
      }
    >
      {card.state === CARD_STATE.NOT_CONNECTED && !card.disconnectedAt && <p>{MARKETPLACE_PITCH(card.label)}</p>}
      {card.state === CARD_STATE.NOT_CONNECTED && card.disconnectedAt && !card.reason && (
        <p>{CARD.disconnectedBy(card.disconnectedBy, card.disconnectedAt)}</p>
      )}
      {card.state === CARD_STATE.NOT_CONNECTED && card.reason && <p>{REASON[card.reason](card.label)}</p>}
      {card.state === CARD_STATE.UNAVAILABLE && <p>{CARD.unavailable(card.label)}</p>}
      {card.state === CARD_STATE.FULL && <p>{CARD.full(card.label)}</p>}
      {card.state === CARD_STATE.RENEWAL_DUE && <p>{CARD.renewalWhy}</p>}
      {card.state === CARD_STATE.NEEDS_RECONNECT && card.reason && <p>{REASON[card.reason](card.label)}</p>}
      {live && card.connectedAt && <ExpandableLine>{CARD.connectedBy(card.connectedBy, card.connectedAt)}</ExpandableLine>}
      {live && card.lastCheckedAt && (
        <p className={card.stale ? "font-medium text-warning" : undefined}>
          {lastChecked(card.lastCheckedAt)}
          {card.reapproveBy && card.state === CARD_STATE.CONNECTED ? ` · ${CARD.reapproveBy(card.reapproveBy)}` : ""}
        </p>
      )}
      {live && card.stockSync === STOCK_SYNC.ON && <p>{STOCK.cardOn}</p>}
      {live && card.stockSync === STOCK_SYNC.PAUSED && <p className="font-medium text-warning">{STOCK.paused}</p>}
      {reading && (
        <div className="flex flex-col gap-1">
          <p className={cn(reading.tone === "warning" && "font-medium text-warning", reading.tone === "error" && "font-medium text-destructive")}>
            {reading.text}
          </p>
          {reading.running && card.read?.total ? (
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
              <div
                className="h-full bg-primary"
                style={{ width: `${Math.min(100, Math.round(((card.read.done ?? 0) / card.read.total) * 100))}%` }}
              />
            </div>
          ) : null}
        </div>
      )}
    </ChannelCardShell>
  );
}
