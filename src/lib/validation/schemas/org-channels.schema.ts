import { z } from "zod";

import { CHANNEL } from "@server/shared/channels";

/**
 * The channels a shop turns on with a tap: Google and Meta, which read our feed and need no account.
 * A marketplace is on only by connecting it (channel-connectors D11), so Amazon and Flipkart are
 * refused here; accepting them would let a request switch a marketplace on with no connection, or
 * undo a disconnect. A channel left out of the body is left as it was.
 */
const FEED_CHANNELS = [CHANNEL.GOOGLE, CHANNEL.META] as const;
export const orgChannelsSchema = z.object({
  channels: z
    .array(
      z.object({
        channel: z.enum(FEED_CHANNELS),
        enabled: z.boolean(),
      }),
    )
    .max(FEED_CHANNELS.length),
});

export type OrgChannelsFormValues = z.input<typeof orgChannelsSchema>;
export type OrgChannelsParsed = z.output<typeof orgChannelsSchema>;
export type FeedChannel = (typeof FEED_CHANNELS)[number];
export const isFeedChannel = (value: string): value is FeedChannel => (FEED_CHANNELS as readonly string[]).includes(value);
