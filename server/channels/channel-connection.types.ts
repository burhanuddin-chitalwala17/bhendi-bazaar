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
  /** The marketplace account is already connected to another shop (channel-import Q10). */
  OTHER_SHOP: "other_shop",
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
  /** The listing read, and what it found (channel-import). Null for channels with no listings. */
  read: ChannelReadDTO | null;
  listings: { total: number; linked: number } | null;
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

/** A listing read's progress, stored on the connection (channel-import D2). */
export const READ_STATE = { RUNNING: "RUNNING", DONE: "DONE", STOPPED: "STOPPED" } as const;
export type ReadState = (typeof READ_STATE)[keyof typeof READ_STATE];

/**
 * A running read silent this long is taken to have died with its worker: another job may claim it,
 * and the owner is offered Read again. Readers report in every few seconds, so this is generous.
 */
export const READ_STALL_MS = 5 * 60_000;

/** Why a read stopped. A code, never marketplace text. */
export const READ_ERROR = {
  /** The marketplace was busy or unreachable; the job retries by itself. */
  BUSY: "busy",
  /** The marketplace refused our access; the shop must reconnect. */
  AUTH: "auth",
  /** The Flipkart account is already connected to another shop (Q10). */
  OTHER_SHOP: "other_shop",
  /** The account read is not the one this connection was made with (ux.md: different account). */
  DIFFERENT_ACCOUNT: "different_account",
} as const;
export type ReadError = (typeof READ_ERROR)[keyof typeof READ_ERROR];

/** A listing's status on its marketplace, in our three words. */
export const LISTING_STATUS = { LIVE: "LIVE", INACTIVE: "INACTIVE", INCOMPLETE: "INCOMPLETE" } as const;
export type ListingStatus = (typeof LISTING_STATUS)[keyof typeof LISTING_STATUS];

/** How a listing came to be linked. */
export const LINK_SOURCE = { SKU: "SKU", OWNER: "OWNER" } as const;
export type LinkSource = (typeof LINK_SOURCE)[keyof typeof LINK_SOURCE];

export interface ChannelReadDTO {
  state: ReadState | null;
  total: number | null;
  done: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  error: ReadError | null;
  /** Running, but silent past `READ_STALL_MS`. */
  stalled: boolean;
}

export interface ChannelListingDTO {
  id: string;
  sku: string;
  externalId: string | null;
  title: string | null;
  imageUrl: string | null;
  status: ListingStatus | null;
  pricePaise: number | null;
  quantity: number | null;
  parentSku: string | null;
  parentTitle: string | null;
  variationAxis: string | null;
  product: { id: string; name: string; sku: string | null; archived: boolean } | null;
  linkSource: LinkSource | null;
  unlinkedByOwner: boolean;
  gone: boolean;
}

/** A listing beside the product it is (or was) linked to, for the details panel (channel-import Q17). */
export interface ChannelListingDetailDTO {
  listing: ChannelListingDTO;
  /** The linked product's own values; null when not linked. */
  product: {
    id: string;
    name: string;
    sku: string | null;
    pricePaise: number;
    imageUrl: string | null;
    stock: number;
    archived: boolean;
  } | null;
  /** For a listing the owner unlinked: the product its SKU names, which Link back restores. */
  linkBackTo: { id: string; name: string } | null;
}

/** One marketplace's listings for the Listings page. */
export interface ChannelListingsPageDTO {
  channel: MarketplaceChannel;
  label: string;
  connected: boolean;
  read: ChannelReadDTO;
  counts: { linked: number; notLinked: number };
  listings: ChannelListingDTO[];
  hasMore: boolean;
}

/** One connected marketplace on a product's "On marketplaces" block (channel-import R11). */
export interface ProductMarketplaceLinkDTO {
  channel: MarketplaceChannel;
  label: string;
  needsReconnect: boolean;
  /** The listing linked to this product there, or null: "Not linked". */
  listing: {
    id: string;
    externalId: string | null;
    status: ListingStatus | null;
    pricePaise: number | null;
    quantity: number | null;
    gone: boolean;
  } | null;
}
