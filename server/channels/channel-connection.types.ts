import { CHANNEL, type Channel } from "@server/shared/channels";
import type { StockSyncState } from "./channel-stock.types";
import type { SocialPlatform } from "./social/types";
import type { SettleFactsDTO, SettleTypeDTO } from "./channel-facts.types";

/**
 * The shapes the channels domain answers with (channel-connectors TRD). Nothing here carries a
 * credential: tokens never leave this domain.
 */

/** The marketplaces a shop connects by consent. Meesho has no public API (INTEGRATIONS.md). */
export const MARKETPLACE_CHANNELS = [CHANNEL.AMAZON, CHANNEL.FLIPKART] as const;
export type MarketplaceChannel = (typeof MARKETPLACE_CHANNELS)[number];

export const isMarketplaceChannel = (value: string): value is MarketplaceChannel =>
  (MARKETPLACE_CHANNELS as readonly string[]).includes(value);

/** What a `ChannelConnection` may be to: a marketplace, or a social platform (ADR-0068). */
export type ConnectionChannel = MarketplaceChannel | SocialPlatform;

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
  /** WhatsApp offboarded the number: the Business app was set up again on another phone (connect-whatsapp R11). */
  OFFBOARDED: "offboarded",
  /** The shop removed our app inside Instagram or Meta (meta-foundation D6). */
  REMOVED_IN_APP: "removed_in_app",
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
  /** An Instagram personal account: nothing stored (connect-instagram R3). */
  PERSONAL: "personal",
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
  listings: { total: number; linked: number; toSettle: number } | null;
  /** Amazon only: the date its yearly re-approval falls due (ISO). */
  reapproveBy: string | null;
  reason: ConnectionError | null;
  /** Stock sync, on by itself once connected (inventory-sync Q28); paused only by the shop. Null when not connected. */
  stockSync: StockSyncState | null;
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
  /** The marketplace refused the read's request itself (a 4xx); retrying will not change it. */
  NOT_ALLOWED: "not_allowed",
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

/** Why a listing was left off, when it is not simply the owner's choice (marketplace-facts Q6). The database checks the set. */
export const LEFT_OFF_REASON = { NO_TYPE: "no_type" } as const;
export type LeftOffReason = (typeof LEFT_OFF_REASON)[keyof typeof LEFT_OFF_REASON];

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
  /** The owner chose not to sell it on Bhendi Bazaar (product-merge Q9). */
  leftOff: boolean;
  /** Parked until a product type exists (marketplace-facts Q6): the marketplace's type, for the message to the admin. */
  waitingForType: { marketplaceType: string } | null;
  gone: boolean;
  /** A hint on an unsettled row (product-merge D3): the same SKU elsewhere, or a similar product. */
  suggestion: ListingSuggestionDTO | null;
  /** Photos being copied from this listing onto its product (product-merge D6). */
  photos: { total: number; done: number; failed: number } | null;
  /** What the marketplace says stops or limits it, from the daily look (marketplace-publish Q23); null when clean. */
  problems: { suppressed: boolean; first: string; count: number } | null;
}

export const SUGGESTION_KIND = { SAME_SKU: "same_sku", SIMILAR_NAME: "similar_name" } as const;
export type SuggestionKind = (typeof SUGGESTION_KIND)[keyof typeof SUGGESTION_KIND];

export interface ListingSuggestionDTO {
  kind: SuggestionKind;
  /** The other marketplace's label for a same-SKU listing, or the similar product's name. */
  text: string;
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
  /** `notLinked` is the to-do: unsettled and not left off. */
  counts: { linked: number; notLinked: number; leftOff: number; problems: number };
  showingLeftOff: boolean;
  /** Only the linked listings the marketplace complains of (marketplace-publish Q23). */
  showingProblems: boolean;
  listings: ChannelListingDTO[];
  hasMore: boolean;
  /** Each variation group on the page, across tabs: what its header offers (family-merge D6). */
  groups: Record<string, ListingGroupDTO>;
  /** No family has been made from this marketplace yet: the first group explains itself (Q22). */
  firstFamily: boolean;
  /** Listings that look like one item, where the marketplace does not group them (family-merge Q5). */
  sameItem: Array<{ listingIds: string[]; titles: string[] }>;
}

export const GROUP_STATE = { SETTLE: "settle", MAKE: "make", ADD: "add", FAMILY: "family" } as const;
export type GroupState = (typeof GROUP_STATE)[keyof typeof GROUP_STATE];

export interface ListingGroupDTO {
  state: GroupState;
  /** Every member's listing id, for the family page. */
  listingIds: string[];
  total: number;
  settled: number;
  family: { id: string; name: string; productId: string } | null;
  /** Members outside the family, when it exists. */
  outside: number;
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
    linkSource: LinkSource | null;
    /** Photos being copied from this listing onto the product (product-merge D6). */
    photos: { total: number; done: number; failed: number } | null;
    /** Stock sync for this listing (inventory-sync ux.md "Product and Marketplace orders"); null when sync is off. */
    stock: { sent: number | null; sentAt: string | null; heldByMarketplace: boolean; oversold: { orderId: string } | null } | null;
  } | null;
}

/** One listing as the Settle page shows it, read live from its marketplace (product-merge D1, D2). */
export interface SettleSideDTO {
  listingId: string;
  channel: MarketplaceChannel;
  label: string;
  sku: string;
  externalId: string | null;
  status: ListingStatus | null;
  /** Live there and still listed: a new product made from it goes on sale (Q12). */
  live: boolean;
  pricePaise: number | null;
  quantity: number | null;
  title: string | null;
  description: string | null;
  /** Hotlinked for display; the copy re-reads them on the server (D6). */
  photoUrls: string[];
  /** The live read failed; the row's stored values stand in. */
  readFailed: boolean;
}

/** Everything the Settle page needs (product-merge ux.md "Settle page"). */
export interface SettleDetailDTO {
  mode: "new" | "match";
  primary: SettleSideDTO;
  /** The same item on the shop's other marketplace (Q4): by SKU, kept on; by name, off. */
  pair: { side: SettleSideDTO; reason: SuggestionKind } | null;
  product: {
    id: string;
    name: string;
    sku: string | null;
    description: string;
    pricePaise: number;
    photoUrls: string[];
    archived: boolean;
    stock: Array<{ locationId: string; quantity: number }>;
  } | null;
  locations: Array<{ id: string; name: string }>;
  defaultCategoryId: string | null;
  /** The type question a new product starts with, when the marketplace names its type (marketplace-facts D9). */
  type: SettleTypeDTO | null;
  /** The listing is one of a variation group: settle them all as one family instead (family-merge Q22). */
  group: { listingIds: string[]; total: number; axis: string | null; name: string } | null;
  /** Amazon's facts per type, to fill and answer before saving (marketplace-facts Q35). */
  facts: SettleFactsDTO | null;
  /** When the inbox was last read: the "As Amazon reported 3 days ago" line. */
  readFinishedAt: string | null;
}

/** A settle as the channels domain takes it, after the route has parsed it (product-merge D4, D10). */
export interface SettleInput {
  listingIds: string[];
  productId?: string;
  name?: string;
  description?: string;
  photosFrom?: string;
  uploadedPhoto?: string;
  sku?: string;
  pricePaise?: number;
  categoryId?: string;
  stock: Array<{ locationId: string; quantity: number; seenQuantity?: number }>;
  onSale?: boolean;
  /** The owner's answers to the primary listing's unclear facts, fact → our answer's key (marketplace-facts Q35). */
  answers?: Record<string, string>;
}

export interface SettleResultDTO {
  productId: string;
  productName: string;
  archived: boolean;
  mode: "new" | "match";
}

/** A product the match picker offers (product-merge ux.md "Match picker"). */
export interface SettlePickerProductDTO {
  id: string;
  name: string;
  sku: string | null;
  pricePaise: number;
  imageUrl: string | null;
  archived: boolean;
  /** Already linked to another listing on this marketplace (Q22). */
  linkedHere: boolean;
}

/** Why a marketplace's published types could not be read for the platform (setup-requests Q14). */
export const TYPES_UNAVAILABLE = { NOT_CONNECTED: "not_connected", UNREACHABLE: "unreachable" } as const;
export type TypesUnavailable = (typeof TYPES_UNAVAILABLE)[keyof typeof TYPES_UNAVAILABLE];
