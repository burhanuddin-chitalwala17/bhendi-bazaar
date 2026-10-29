import { MarketplaceRequestError } from "../marketplace-provider";
import { paiseFromRupees, retryBusy, sleepFor, type TokenSource } from "../listing-read";
import {
  ORDER_LINE_STATE,
  type ListingStock,
  type LocationCount,
  type MarketplaceLocation,
  type MarketplaceOrderLine,
  type OrderLineState,
  type OrdersPage,
  type StockListingRef,
} from "../stock";
import { AMAZON_IN, spApi } from "./amazon.listings";

/** Amazon's one location for an account that ships its own orders: its pickup address (inventory-sync Q12). */
export const AMAZON_LOCATION = "DEFAULT";

/**
 * Amazon's locations for an account (inventory-sync D1). Supply sources (multi-location) are not
 * ours to read (403, checked 2026-10-29), so an account that ships its own orders is one location.
 */
export async function amazonLocations(_token: TokenSource, _account: string | null): Promise<MarketplaceLocation[]> {
  return [{ externalId: AMAZON_LOCATION, name: "Amazon pickup address", pincode: null }];
}

const obj = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

/** A listing's counts from `getListingsItem`: the one the shop ships itself (`DEFAULT`), or none when Amazon holds it (FBA, Q5). */
export function stockFromItem(body: unknown): ListingStock {
  const availability = Array.isArray(obj(body).fulfillmentAvailability) ? (obj(body).fulfillmentAvailability as unknown[]).map(obj) : [];
  const own = availability.find((a) => a.fulfillmentChannelCode === AMAZON_LOCATION);
  const quantity = typeof own?.quantity === "number" ? own.quantity : null;
  return {
    counts: quantity === null ? [] : [{ externalId: AMAZON_LOCATION, quantity }],
    heldByMarketplace: !own && availability.length > 0,
  };
}

const itemPath = (account: string, sku: string) =>
  `/listings/2021-08-01/items/${encodeURIComponent(account)}/${encodeURIComponent(sku)}?marketplaceIds=${AMAZON_IN}`;

/** The listing's counts on Amazon now (inventory-sync D5, D6). */
export async function amazonReadStock(token: TokenSource, account: string | null, listing: StockListingRef): Promise<ListingStock> {
  if (!account) return { counts: [], heldByMarketplace: false };
  return stockFromItem(await retryBusy(() => spApi(token, "stock read", `${itemPath(account, listing.sku)}&includedData=fulfillmentAvailability`)));
}

/**
 * Send our count (inventory-sync D3): a `patchListingsItem` of `fulfillment_availability` on the
 * shop's own (`DEFAULT`) channel, which validated on production 2026-10-29. Amazon answers with a status
 * and issues; an invalid patch is a refusal, never a silent success.
 */
export async function amazonSetStock(token: TokenSource, account: string | null, listing: StockListingRef, counts: readonly LocationCount[]): Promise<void> {
  if (!account) throw new MarketplaceRequestError(400, "amazon stock: no account");
  const quantity = counts.find((c) => c.externalId === AMAZON_LOCATION)?.quantity ?? 0;
  let productType = listing.marketplaceType;
  if (!productType) {
    const item = obj(await retryBusy(() => spApi(token, "stock type", `${itemPath(account, listing.sku)}&includedData=summaries`)));
    productType = String(obj(Array.isArray(item.summaries) ? item.summaries[0] : null).productType ?? "PRODUCT");
  }
  const result = obj(
    await retryBusy(() =>
      spApi(token, "stock patch", itemPath(account, listing.sku), {
        method: "PATCH",
        body: JSON.stringify({
          productType,
          patches: [{ op: "replace", path: "/attributes/fulfillment_availability", value: [{ fulfillment_channel_code: AMAZON_LOCATION, quantity }] }],
        }),
      }),
    ),
  );
  if (result.status === "INVALID") throw new MarketplaceRequestError(400, "amazon stock patch invalid");
}

const STATE: Record<string, OrderLineState> = {
  Canceled: ORDER_LINE_STATE.CANCELLED,
  Shipped: ORDER_LINE_STATE.SHIPPED,
  InvoiceUnconfirmed: ORDER_LINE_STATE.SHIPPED,
};
const str = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);
/** The first check looks back this far; afterwards the cursor carries on from the last change seen. */
const FIRST_LOOKBACK_MS = 24 * 60 * 60_000;
const ITEMS_PACE_MS = 2_100;

/**
 * Orders changed since the cursor (inventory-sync D4, Q21): the Orders API v0, whose shape is
 * documented and which answered for our app on 2026-10-29; it is removed on 2027-03-27, so moving
 * to `searchOrders` is in BACKLOG. Each order's lines come from its items call, paced to its limit.
 */
export async function amazonReadOrders(token: TokenSource, _account: string | null, cursor: string | null): Promise<OrdersPage> {
  // Amazon refuses a LastUpdatedAfter within two minutes of now, as a cursor set at turn-on can be.
  const ceiling = new Date(Date.now() - 2 * 60_000).toISOString();
  const wanted = cursor ?? new Date(Date.now() - FIRST_LOOKBACK_MS).toISOString();
  const since = wanted < ceiling ? wanted : ceiling;
  const lines: MarketplaceOrderLine[] = [];
  let next: string | null = null;
  let latest = since;
  do {
    const query = next ? `NextToken=${encodeURIComponent(next)}` : `LastUpdatedAfter=${encodeURIComponent(since)}`;
    const page = obj(obj(await retryBusy(() => spApi(token, "orders", `/orders/v0/orders?MarketplaceIds=${AMAZON_IN}&${query}`))).payload);
    for (const raw of Array.isArray(page.Orders) ? page.Orders : []) {
      const order = obj(raw);
      const orderId = str(order.AmazonOrderId);
      if (!orderId) continue;
      const updated = str(order.LastUpdateDate);
      if (updated && updated > latest) latest = updated;
      const state = STATE[String(order.OrderStatus)] ?? ORDER_LINE_STATE.OPEN;
      const orderedAt = new Date(str(order.PurchaseDate) ?? Date.now());
      await sleepFor(ITEMS_PACE_MS);
      const items = obj(obj(await retryBusy(() => spApi(token, "order items", `/orders/v0/orders/${encodeURIComponent(orderId)}/orderItems`))).payload);
      for (const rawItem of Array.isArray(items.OrderItems) ? items.OrderItems : []) {
        const item = obj(rawItem);
        const lineId = str(item.OrderItemId);
        const sku = str(item.SellerSKU);
        const quantity = typeof item.QuantityOrdered === "number" ? item.QuantityOrdered : Number(item.QuantityOrdered);
        if (!lineId || !sku || !Number.isFinite(quantity) || quantity <= 0) continue;
        lines.push({ orderId, lineId, sku, quantity, locationExternalId: AMAZON_LOCATION, state, amountPaise: paiseFromRupees(obj(item.ItemPrice).Amount), orderedAt });
      }
    }
    next = str(page.NextToken);
  } while (next);
  return { lines, cursor: latest < ceiling ? latest : ceiling };
}
