import { z } from "zod";

import { PUBLISHABLE_CHANNELS, type Channel } from "@server/shared/channels";

/**
 * Where a shop has said it sells ([channel-registry](../../../../docs/specs/channel-registry/) R9).
 *
 * The whole set is sent every time, so a channel left out of the body is a channel the form did
 * not show rather than one being switched off. This storefront is not among them: it is where
 * the shop already is, not somewhere it opts into.
 */
export const orgChannelsSchema = z.object({
  channels: z
    .array(
      z.object({
        channel: z.enum(PUBLISHABLE_CHANNELS as unknown as [Channel, ...Channel[]]),
        enabled: z.boolean(),
      }),
    )
    .max(PUBLISHABLE_CHANNELS.length),
});

export type OrgChannelsFormValues = z.input<typeof orgChannelsSchema>;
export type OrgChannelsParsed = z.output<typeof orgChannelsSchema>;
