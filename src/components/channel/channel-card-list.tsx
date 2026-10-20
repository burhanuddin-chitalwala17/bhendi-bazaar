import Link from "next/link";

import { Button } from "@/components/ui/button";
import { CHANNEL } from "@server/shared/channels";
import { isFeedChannel } from "@/lib/validation/schemas/org-channels.schema";
import { CARD_STATE, type ChannelCardDTO } from "@server/channels/channel-connection.types";

import { ChannelCardShell } from "./channel-card-shell";
import { ACTION, CARD, CHIP, FEED } from "./channel-copy";
import { ExpandableLine } from "./expandable-line";
import { FeedToggle } from "./feed-toggle";
import { MarketplaceCard } from "./marketplace-card";

interface ChannelCardListProps {
  orgId: string;
  cards: ChannelCardDTO[];
  storePath: string | null;
  /** Our host and the store's path, as a shop would type it (from `appUrl()`, never hardcoded). */
  storeLabel: string | null;
}

/**
 * Every channel the shop sells on, or could: own store, marketplaces, feeds, in that order. One
 * column on a phone, two from `md:`, three from `lg:` (ux.md form factors).
 */
export function ChannelCardList({ orgId, cards, storePath, storeLabel }: ChannelCardListProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => {
        if (card.state === CARD_STATE.ALWAYS_ON) {
          return (
            <ChannelCardShell key={card.channel} label={CARD.storeTitle} chip={{ tone: "connected", text: CHIP.alwaysOn }}>
              {storePath && storeLabel && (
                <>
                  <ExpandableLine className="text-sm text-muted-foreground">{storeLabel}</ExpandableLine>
                  <Button asChild variant="outline" className="min-h-10 w-full md:w-auto">
                    <Link href={storePath}>{ACTION.viewStore}</Link>
                  </Button>
                </>
              )}
            </ChannelCardShell>
          );
        }
        if ((card.state === CARD_STATE.FEED_ON || card.state === CARD_STATE.FEED_OFF) && isFeedChannel(card.channel)) {
          const on = card.state === CARD_STATE.FEED_ON;
          const copy = card.channel === CHANNEL.META ? FEED.meta : FEED.google;
          return (
            <ChannelCardShell
              key={card.channel}
              label={card.label}
              headerAction={<FeedToggle orgId={orgId} channel={card.channel} on={on} />}
            >
              <p className="text-sm text-muted-foreground">{on ? copy.on : copy.off}</p>
            </ChannelCardShell>
          );
        }
        return <MarketplaceCard key={card.channel} orgId={orgId} card={card} />;
      })}
    </div>
  );
}
