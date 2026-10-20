import { CARD_STATE, type ChannelCardDTO } from "@server/channels/channel-connection.types";
import type { MarketplaceChannel } from "@server/channels/channel-connection.types";

import { ChannelCardShell } from "./channel-card-shell";
import { CARD, CHIP, MARKETPLACE_PITCH, REASON, lastChecked } from "./channel-copy";
import { ExpandableLine } from "./expandable-line";
import { MarketplaceCardActions } from "./marketplace-card-actions";

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

  return (
    <ChannelCardShell label={card.label} chip={chipFor(card)}>
      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
        {card.state === CARD_STATE.NOT_CONNECTED && !card.disconnectedAt && <p>{MARKETPLACE_PITCH(card.label)}</p>}
        {card.state === CARD_STATE.NOT_CONNECTED && card.disconnectedAt && (
          <p>{CARD.disconnectedBy(card.disconnectedBy, card.disconnectedAt)}</p>
        )}
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
      </div>
      <MarketplaceCardActions
        orgId={orgId}
        channel={card.channel as MarketplaceChannel}
        label={card.label}
        state={card.state}
        stale={card.stale}
      />
    </ChannelCardShell>
  );
}
