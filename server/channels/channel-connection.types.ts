import { CHANNEL, type Channel } from "@server/shared/channels";

/**
 * The shapes the channels domain answers with (channel-connectors TRD). Nothing here carries a
 * credential: tokens never leave this domain.
 */

/** The marketplaces a shop connects by consent. Meesho has no public API (INTEGRATIONS.md). */
export const MARKETPLACE_CHANNELS = [CHANNEL.AMAZON, CHANNEL.FLIPKART] as const;
export type MarketplaceChannel = (typeof MARKETPLACE_CHANNELS)[number];

export const isMarketplaceChannel = (value: string): value is MarketplaceChannel =>
  (MARKETPLACE_CHANNELS as readonly string[]).includes(value);

/** What a `ChannelConnection` row stores (D2). The rest of a card's state is derived on read. */
export const CONNECTION_STATE = {
  CONNECTED: "CONNECTED",
  NEEDS_RECONNECT: "NEEDS_RECONNECT",
  DISCONNECTED: "DISCONNECTED",
} as const;
export type ConnectionState = (typeof CONNECTION_STATE)[keyof typeof CONNECTION_STATE];

/** Why a connection needs the shop. A code, never marketplace text (D6). */
export const CONNECTION_ERROR = {
  /** The marketplace refused our access when we used it. */
  REJECTED: "rejected",
  /** The renewal credential lapsed (Flipkart's 180 days). */
  EXPIRED: "expired",
  /** The shop removed our app on the marketplace. */
  REVOKED: "revoked",
} as const;
export type ConnectionError = (typeof CONNECTION_ERROR)[keyof typeof CONNECTION_ERROR];

/** Every state a channel card can show (ux.md, "State matrix — Marketplace card"). */
export const CARD_STATE = {
  ALWAYS_ON: "always_on",
  FEED_ON: "feed_on",
  FEED_OFF: "feed_off",
  NOT_CONNECTED: "not_connected",
  CONNECTED: "connected",
  RENEWAL_DUE: "renewal_due",
  NEEDS_RECONNECT: "needs_reconnect",
  UNAVAILABLE: "unavailable",
  FULL: "full",
} as const;
export type CardState = (typeof CARD_STATE)[keyof typeof CARD_STATE];

/** Every way back from a marketplace's consent page (D6). The page maps each to ux.md's copy. */
export const CONNECT_RESULT = {
  CONNECTED: "connected",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
  OTHER_SESSION: "other_session",
  OTHER_SHOP: "other_shop",
  DIFFERENT_ACCOUNT: "different_account",
  UNREACHABLE: "unreachable",
  FULL: "full",
  UNAVAILABLE: "unavailable",
} as const;
export type ConnectResult = (typeof CONNECT_RESULT)[keyof typeof CONNECT_RESULT];

export const isConnectResult = (value: string): value is ConnectResult =>
  (Object.values(CONNECT_RESULT) as string[]).includes(value);

export interface ChannelCardDTO {
  channel: Channel;
  label: string;
  state: CardState;
  /** Who connected, or last disconnected, and when (ISO). */
  connectedBy: string | null;
  connectedAt: string | null;
  disconnectedBy: string | null;
  disconnectedAt: string | null;
  lastCheckedAt: string | null;
  /** True when the last successful contact is older than a day (ux.md "Stale"). */
  stale: boolean;
  /** Amazon only: the date its yearly re-approval falls due (ISO). */
  reapproveBy: string | null;
  reason: ConnectionError | null;
}

export interface ChannelAttentionDTO {
  channel: MarketplaceChannel;
  label: string;
  state: typeof CARD_STATE.RENEWAL_DUE | typeof CARD_STATE.NEEDS_RECONNECT;
  reapproveBy: string | null;
}

export interface ChannelsOverviewDTO {
  cards: ChannelCardDTO[];
  /** What the dashboard banner shows (spec R9). */
  attention: ChannelAttentionDTO[];
}

/** Where a connect attempt goes next: to the marketplace, or straight back with an outcome. */
export type ConnectStart = { redirectTo: string } | { result: ConnectResult };
