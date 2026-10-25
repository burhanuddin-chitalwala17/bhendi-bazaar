import { z } from "zod";

import { PUBLISHABLE_CHANNELS, type Channel } from "@server/shared/channels";

/**
 * One decision the platform owner takes in the register: what a channel calls one of our answers
 * ([channel-registry](../../../../docs/specs/channel-registry/) R8, D12).
 *
 * `theirValue` is free text because it is somebody else's vocabulary — we hold their list for
 * Flipkart and not for every channel, so a closed set here would be a set that goes stale on
 * their release schedule rather than ours.
 */
export const channelValueMappingSchema = z.object({
  channel: z.enum(PUBLISHABLE_CHANNELS as unknown as [Channel, ...Channel[]]),
  list: z.string().trim().min(1).max(60),
  valueKey: z.string().trim().min(1).max(80),
  theirValue: z.string().trim().min(1, "Say what they call it").max(200),
});

export type ChannelValueMappingInput = z.output<typeof channelValueMappingSchema>;

/**
 * Whether a product type sells on a channel at all (channel-registry D12).
 *
 * `notSold: true` records the owner deciding it does not, which is different from nobody having
 * chosen yet — and `false` puts the choice back, so the decision is never a one-way door.
 */
export const channelNotSoldSchema = z.object({
  channel: z.enum(PUBLISHABLE_CHANNELS as unknown as [Channel, ...Channel[]]),
  productType: z.string().trim().min(1).max(60),
  kind: z.string().trim().min(1).max(60).nullable(),
  notSold: z.boolean(),
});

export type ChannelNotSoldInput = z.output<typeof channelNotSoldSchema>;

/**
 * The marketplace types one of our types and kinds is read from, and the one it publishes to
 * (marketplace-facts Q26). One request is one change, so each is audited on its own.
 */
export const channelTypeChangeSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"),
    channel: z.enum(PUBLISHABLE_CHANNELS as unknown as [Channel, ...Channel[]]),
    productType: z.string().trim().min(1).max(60),
    kind: z.string().trim().min(1).max(60).nullable(),
    theirCategory: z
      .string()
      .trim()
      .min(1, "Name the marketplace's type")
      .max(120)
      .regex(/^[A-Za-z0-9_ -]+$/, "Use the type's name as the marketplace writes it"),
  }),
  z.object({ action: z.literal("publish"), id: z.string().min(1).max(64) }),
  z.object({ action: z.literal("remove"), id: z.string().min(1).max(64), typeLabel: z.string().trim().min(1).max(80) }),
]);

export type ChannelTypeChangeInput = z.input<typeof channelTypeChangeSchema>;
