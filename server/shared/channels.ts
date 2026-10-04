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
 *
 * **Declared rather than stored** (channel-registry D1). A channel needs code in three places
 * before it can do anything — an image rule, a readiness rule, and an adapter — so a row an
 * admin could add would be a row that does nothing. What a *shop* chooses is data: `OrgChannel`.
 */

export const CHANNEL = {
  STORE: "store",
  GOOGLE: "google",
  META: "meta",
  AMAZON: "amazon",
  FLIPKART: "flipkart",
  MEESHO: "meesho",
} as const;

export type Channel = (typeof CHANNEL)[keyof typeof CHANNEL];

/** The order a channel is shown in, wherever a list of them is rendered. */
export const CHANNELS = Object.values(CHANNEL) as readonly Channel[];

export const isChannel = (value: string): value is Channel =>
  (CHANNELS as readonly string[]).includes(value);

/**
 * What kind each channel is, which decides what machinery it gets
 * ([ADR-0041](../../docs/adr/0041-a-channel-is-classed-by-where-the-sale-completes.md)).
 *
 * A **shopfront** is published to but the sale completes here, so it gets a feed and nothing
 * else — no credentials, no order reader, no stock reconciliation, because no stock can diverge.
 * A **marketplace** gets the full set. The kind belongs to the channel, never to a shop or a
 * product: an unconnected marketplace is a marketplace that is off, not a shopfront.
 */
export const CHANNEL_KIND = {
  STOREFRONT: "storefront",
  SHOPFRONT: "shopfront",
  MARKETPLACE: "marketplace",
  /** Declared and unimplemented: ONDC is joined, not published to (ADR-0041 decision 5). */
  NETWORK: "network",
} as const;

export type ChannelKind = (typeof CHANNEL_KIND)[keyof typeof CHANNEL_KIND];

export const CHANNEL_KINDS: Readonly<Record<Channel, ChannelKind>> = {
  [CHANNEL.STORE]: CHANNEL_KIND.STOREFRONT,
  // One feed serves both: Meta accepts Google's own RSS namespace, though not its values.
  [CHANNEL.GOOGLE]: CHANNEL_KIND.SHOPFRONT,
  [CHANNEL.META]: CHANNEL_KIND.SHOPFRONT,
  [CHANNEL.AMAZON]: CHANNEL_KIND.MARKETPLACE,
  [CHANNEL.FLIPKART]: CHANNEL_KIND.MARKETPLACE,
  [CHANNEL.MEESHO]: CHANNEL_KIND.MARKETPLACE,
};

/** How a channel is named to a shop. */
export const CHANNEL_LABELS: Readonly<Record<Channel, string>> = {
  [CHANNEL.STORE]: "This storefront",
  [CHANNEL.GOOGLE]: "Google Shopping",
  [CHANNEL.META]: "Meta (Facebook & Instagram)",
  [CHANNEL.AMAZON]: "Amazon",
  [CHANNEL.FLIPKART]: "Flipkart",
  [CHANNEL.MEESHO]: "Meesho",
};

export const kindOf = (channel: Channel): ChannelKind => CHANNEL_KINDS[channel];

/** The channels a product is ever published to — everything but this storefront. */
export const PUBLISHABLE_CHANNELS = CHANNELS.filter(
  (channel) => CHANNEL_KINDS[channel] !== CHANNEL_KIND.STOREFRONT,
);
