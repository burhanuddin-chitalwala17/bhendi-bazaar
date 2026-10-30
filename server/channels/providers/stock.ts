/**
 * What a marketplace's provider answers about stock and orders (inventory-sync D1, D3–D5), in one
 * shape for every marketplace. Nothing outside a provider knows a marketplace's own field names.
 */

/** One pickup location the marketplace knows for the account. */
export interface MarketplaceLocation {
  externalId: string;
  name: string;
  pincode: string | null;
}

/** A listing as a stock call needs it. */
export interface StockListingRef {
  sku: string;
  externalId: string | null;
  /** The marketplace's own type for the listing, when a read stored one (marketplace-facts D6). */
  marketplaceType: string | null;
}

/** A listing's count at one marketplace location. */
export interface LocationCount {
  externalId: string;
  quantity: number;
}

/** A listing's counts as the marketplace holds them; `heldByMarketplace` for stock it stores itself (FBA, Q5). */
export interface ListingStock {
  counts: LocationCount[];
  heldByMarketplace: boolean;
}

import { ORDER_LINE_STATE, type OrderLineState } from "../channel-stock.types";

export { ORDER_LINE_STATE, type OrderLineState };

/** One line of one marketplace order, as reported (ADR-0044). */
export interface MarketplaceOrderLine {
  orderId: string;
  lineId: string;
  sku: string;
  quantity: number;
  /** The marketplace location it ships from; null where the marketplace names none (Amazon, one location). */
  locationExternalId: string | null;
  state: OrderLineState;
  /** What the buyer paid for the line, as reported, in paise; null when not given. */
  amountPaise: number | null;
  orderedAt: Date;
}

export interface OrdersPage {
  lines: MarketplaceOrderLine[];
  /** Where the next check starts. */
  cursor: string;
}
