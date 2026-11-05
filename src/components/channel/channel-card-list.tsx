import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { CHANNEL, CHANNEL_LABELS } from "@server/shared/channels";
import { isFeedChannel } from "@/lib/validation/schemas/org-channels.schema";
import { CARD_STATE, type ChannelCardDTO } from "@server/channels/channel-connection.types";

import { ChannelCardShell } from "./channel-card-shell";
import { ACTION, CARD, CHIP, FEED, PLANNED_CHANNEL_COPY, PURPOSE, SECTION } from "./channel-copy";
import { ExpandableLine } from "./expandable-line";
import { FeedToggle } from "./feed-toggle";
import { MarketplaceCard } from "./marketplace-card";
import { channelMark } from "./channel-mark";
import { PlatformMark } from "@/components/ui/icons/platform-marks";

/**
 * Channels with no connector yet: shown so a shop knows they are coming, never offered. A marketplace
 * the server reports as unavailable (`CHANNELS_CONNECT`, TRD D10) joins them.
 */
export const UNBUILT_CHANNELS = [CHANNEL.MEESHO] as const;

/**
 * Wanted and not started (owner, 2026-11-05): shown as coming, never offered. They stay out of
 * `CHANNEL` on purpose — a channel there gets feeds, readiness and image rules it has no use for yet.
 */
export const PLANNED_CHANNELS = ["whatsapp", "instagram"] as const satisfies readonly (keyof typeof PLANNED_CHANNEL_COPY)[];

interface ChannelCardListProps {
  orgId: string;
  cards: ChannelCardDTO[];
  storePath: string | null;
  /** Our host and the store's path, as a shop would type it (from `appUrl()`, never hardcoded). */
  storeLabel: string | null;
}

const GRID = "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3";

/**
 * Where the shop sells, then what is being built (ux.md form factors: one column on a phone, two
 * from `md:`, three from `lg:`). Cards in a row share a height; actions sit right under a rule.
 */
export function ChannelCardList({ orgId, cards, storePath, storeLabel }: ChannelCardListProps) {
  const live = cards.filter((card) => card.state !== CARD_STATE.UNAVAILABLE);
  const soon = cards.filter((card) => card.state === CARD_STATE.UNAVAILABLE);

  return (
    <div className="space-y-8">
      <section className="space-y-4" aria-label={SECTION.live.title}>
        <SectionHeader title={SECTION.live.title} description={SECTION.live.description} />
        <div className={GRID}>
          {live.map((card) => {
            if (card.state === CARD_STATE.ALWAYS_ON) {
              return (
                <ChannelCardShell
                  key={card.channel}
                  label={CARD.storeTitle}
                  purpose={PURPOSE[CHANNEL.STORE]}
                  mark={channelMark(CHANNEL.STORE)}
                  chip={{ tone: "connected", text: CHIP.alwaysOn }}
                  actions={
                    storePath && (
                      <Button asChild variant="outline" size="sm" className="min-h-10">
                        <Link href={storePath}>{ACTION.viewStore}</Link>
                      </Button>
                    )
                  }
                >
                  {storeLabel && <ExpandableLine>{storeLabel}</ExpandableLine>}
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
                  purpose={PURPOSE[card.channel]}
                  mark={channelMark(card.channel)}
                  chip={on ? { tone: "connected", text: CHIP.feedOn } : { tone: "muted", text: CHIP.feedOff }}
                  actions={<FeedToggle orgId={orgId} channel={card.channel} on={on} />}
                >
                  <p>{on ? copy.on : copy.off}</p>
                </ChannelCardShell>
              );
            }
            return <MarketplaceCard key={card.channel} orgId={orgId} card={card} />;
          })}
        </div>
      </section>

      <section className="space-y-4" aria-label={SECTION.soon.title}>
        <SectionHeader title={SECTION.soon.title} description={SECTION.soon.description} />
        <div className={GRID}>
          {[...soon.map((card) => card.channel), ...UNBUILT_CHANNELS].map((channel) => (
            <ChannelCardShell
              key={channel}
              tone="soon"
              label={CHANNEL_LABELS[channel]}
              purpose={PURPOSE[channel]}
              mark={channelMark(channel)}
              chip={{ tone: "muted", text: CHIP.comingSoon }}
            />
          ))}
          {PLANNED_CHANNELS.map((planned) => (
            <ChannelCardShell
              key={planned}
              tone="soon"
              label={PLANNED_CHANNEL_COPY[planned].label}
              purpose={PLANNED_CHANNEL_COPY[planned].purpose}
              mark={<PlatformMark name={planned} size="md" />}
              chip={{ tone: "muted", text: CHIP.comingSoon }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
