import type { MarketplaceChannel } from "./channel-connection.types";

/** One marketplace location on the Match locations sheet (inventory-sync ux.md). */
export interface ChannelLocationDTO {
  id: string;
  name: string;
  pincode: string | null;
  orgAddressId: string | null;
  notUsed: boolean;
  /** Our location whose pincode matches, offered first when nothing is matched yet (Q15). */
  suggestedId: string | null;
  gone: boolean;
  /** Matched to a location of ours that is closed: pick another. */
  closed: boolean;
}

export interface LocationMatchDTO {
  channel: MarketplaceChannel;
  label: string;
  locations: ChannelLocationDTO[];
  shopLocations: Array<{ id: string; name: string; pincode: string; isActive: boolean }>;
  /** Every live marketplace location is matched or not used. */
  complete: boolean;
}

/** A marketplace order line's state (inventory-sync D4); the database checks the same set. */
export const ORDER_LINE_STATE = { OPEN: "open", CANCELLED: "cancelled", SHIPPED: "shipped" } as const;
export type OrderLineState = (typeof ORDER_LINE_STATE)[keyof typeof ORDER_LINE_STATE];

export const STOCK_SYNC = { OFF: "off", ON: "on", PAUSED: "paused" } as const;
export type StockSyncState = (typeof STOCK_SYNC)[keyof typeof STOCK_SYNC];

/** What stopped the last send (D7): the marketplace was busy, or it refused our stock calls. The database checks the same set. */
export const STOCK_PROBLEM = { BUSY: "busy", REFUSED: "refused" } as const;
export type StockProblem = (typeof STOCK_PROBLEM)[keyof typeof STOCK_PROBLEM];

/** The stock sync section on a marketplace's Listings page (inventory-sync ux.md). */
export interface StockSyncSectionDTO {
  channel: MarketplaceChannel;
  label: string;
  state: StockSyncState;
  needsReconnect: boolean;
  /** The last send's problem, until a send goes (D7, ux.md "Retryable error", "Not allowed"). */
  problem: StockProblem | null;
  /** Listings still waiting for their first send since sync went on (ux.md "Sending"). */
  sending: { sent: number; total: number } | null;
  /** Listings whose last send the marketplace turned down; sent again on their next change. */
  refused: number;
  /** A live marketplace location is unmatched, or none is read yet: nothing is sent until matched (Q16). */
  locationsToMatch: boolean;
  /** The marketplace's locations have been read; false just after connecting, before the read ends. */
  locationsRead: boolean;
  /** One that appeared since the last match, named for the section's line. */
  newLocation: { name: string; pincode: string | null } | null;
  sentAt: string | null;
  checkedAt: string | null;
  /** Every linked listing is stocked by the marketplace itself (FBA, Q20). */
  allHeldByMarketplace: boolean;
  /** Today's daily-check corrections, newest first (Q9). */
  corrections: Array<{ title: string; theirs: number; ours: number; at: string }>;
}

/** Home's stock line (inventory-sync Q28): sync waiting on a location match, or listings we put out of stock. */
export const STOCK_ATTENTION = { MATCH: "match", OUT_OF_STOCK: "outOfStock" } as const;
export type StockAttentionKind = (typeof STOCK_ATTENTION)[keyof typeof STOCK_ATTENTION];

export interface StockAttentionDTO {
  channel: MarketplaceChannel;
  label: string;
  kind: StockAttentionKind;
  count: number;
}

/** One line on the Marketplace orders tab (inventory-sync Q10): amounts as reported (ADR-0044). */
export interface MarketplaceOrderDTO {
  id: string;
  channel: MarketplaceChannel;
  label: string;
  orderId: string;
  sku: string;
  quantity: number;
  amountPaise: number | null;
  state: OrderLineState;
  oversold: boolean;
  /** The marketplace named a location not matched: the stock came off the first matched one (Q18). */
  locationGuessed: boolean;
  /** Sold before stock sync was on: recorded, its stock not taken (Q24). */
  beforeSync: boolean;
  /** No product linked to its listing when it came in: recorded, nothing taken. */
  unlinked: boolean;
  orderedAt: string;
}
