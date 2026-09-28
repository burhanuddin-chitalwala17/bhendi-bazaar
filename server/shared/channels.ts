/**
 * Where a shop's goods can be sold, named once.
 *
 * This was declared twice — in `server/content/channel-rules.ts` beside the image rules and in
 * `server/catalog/org-onboarding.types.ts` beside the readiness states — with identical members
 * and no module between them. Two spellings of one closed set is the drift
 * [ADR-0003](../../docs/adr/0003-one-repository-per-aggregate.md) decision 5 forbids, and this
 * particular set is the one the whole multi-channel feature hangs from: an adapter, a mapping,
 * a readiness answer and a shop's choice of where to sell all key on it.
 *
 * It lives in `shared` rather than in either domain because it genuinely spans them and will
 * span more. Catalog asks whether a shop is ready for a channel, content asks whether a
 * photograph meets one, and neither owns the vocabulary.
 */

export const CHANNEL = {
  STORE: "store",
  AMAZON: "amazon",
  FLIPKART: "flipkart",
  INSTAGRAM: "instagram",
} as const;

export type Channel = (typeof CHANNEL)[keyof typeof CHANNEL];

/** The order a channel is shown in, wherever a list of them is rendered. */
export const CHANNELS = Object.values(CHANNEL) as readonly Channel[];

export const isChannel = (value: string): value is Channel =>
  (CHANNELS as readonly string[]).includes(value);
