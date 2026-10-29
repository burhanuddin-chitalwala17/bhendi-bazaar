import { MarketplaceAuthError, MarketplaceRequestError, MarketplaceUnavailableError, marketplaceFetch } from "../marketplace-provider";
import { paiseFromRupees, retryBusy, type TokenSource } from "../listing-read";
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

const HOST = "https://api.flipkart.net/sellers";

export async function flipkartCall(token: TokenSource, path: string, init: { method: "GET" | "POST"; body?: unknown }): Promise<unknown> {
  const response = await marketplaceFetch(`${HOST}${path}`, {
    method: init.method,
    headers: { authorization: `Bearer ${await token()}`, accept: "application/json", ...(init.body ? { "content-type": "application/json" } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (response.status === 401 || response.status === 403) throw new MarketplaceAuthError("rejected");
  if (response.status === 429 || response.status >= 500) throw new MarketplaceUnavailableError(response.status);
  if (!response.ok) throw new MarketplaceRequestError(response.status, `flipkart ${path}`);
  return await response.json();
}

const obj = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const str = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : typeof value === "number" ? String(value) : null);

/** Flipkart's locations, read defensively: its field names vary between its documents. */
export function locationsFrom(body: unknown): MarketplaceLocation[] {
  const list = obj(body).locations;
  return (Array.isArray(list) ? list : []).flatMap((raw) => {
    const l = obj(raw);
    const id = str(l.locationId) ?? str(l.location_id) ?? str(l.id);
    if (!id) return [];
    const address = obj(l.address);
    return [{ externalId: id, name: str(l.locationName) ?? str(l.location_name) ?? str(l.name) ?? id, pincode: str(address.pincode) ?? str(l.pincode) ?? str(address.pinCode) }];
  });
}

/** The account's pickup locations (inventory-sync D1): `GET /locations/allLocations`, checked 2026-10-29. */
export async function flipkartLocations(token: TokenSource, _account: string | null): Promise<MarketplaceLocation[]> {
  return locationsFrom(await flipkartCall(token, "/locations/allLocations", { method: "GET" }));
}

/** A listing's counts per Flipkart location, from listing details (inventory-sync D5). */
export function stockFromDetails(body: unknown, sku: string): ListingStock {
  const item = obj(obj(obj(body).available)[sku]);
  const locations = Array.isArray(item.locations) ? item.locations.map(obj) : [];
  return {
    counts: locations.flatMap((l) => {
      const id = str(l.id);
      const n = typeof l.inventory === "number" ? l.inventory : Number(l.inventory);
      return id && Number.isFinite(n) && n >= 0 ? [{ externalId: id, quantity: Math.floor(n) }] : [];
    }),
    heldByMarketplace: false,
  };
}

/** The listing's counts on Flipkart now. */
export async function flipkartReadStock(token: TokenSource, _account: string | null, listing: StockListingRef): Promise<ListingStock> {
  return stockFromDetails(await retryBusy(() => flipkartCall(token, "/listings/v3/details", { method: "POST", body: { sku_ids: [listing.sku] } })), listing.sku);
}

/**
 * Send our counts per location (inventory-sync D3): `POST /listings/v3/update/inventory`, allowed for
 * our app (checked 2026-10-29). Flipkart answers per SKU; anything but success is a refusal.
 */
export async function flipkartSetStock(token: TokenSource, _account: string | null, listing: StockListingRef, counts: readonly LocationCount[]): Promise<void> {
  if (!listing.externalId) throw new MarketplaceRequestError(400, "flipkart stock: no FSN");
  const body = { [listing.sku]: { product_id: listing.externalId, locations: counts.map((c) => ({ id: c.externalId, inventory: c.quantity })) } };
  const answer = obj(obj(await retryBusy(() => flipkartCall(token, "/listings/v3/update/inventory", { method: "POST", body })))[listing.sku]);
  const status = str(answer.status);
  if (status && status.toUpperCase() !== "SUCCESS") throw new MarketplaceRequestError(400, `flipkart stock update ${status}`);
}

const OPEN_STATES = ["APPROVED", "PACKING_IN_PROGRESS", "FORM_FAILED", "PACKED", "READY_TO_DISPATCH"];
const DISPATCHED_STATES = ["SHIPPED", "DELIVERED"];
const MAX_PAGES = 50;

export function linesFrom(body: unknown, state: OrderLineState): { lines: MarketplaceOrderLine[]; next: string | null } {
  const page = obj(body);
  const lines: MarketplaceOrderLine[] = [];
  for (const rawShipment of Array.isArray(page.shipments) ? page.shipments : []) {
    const shipment = obj(rawShipment);
    const location = str(shipment.locationId) ?? str(shipment.location_id);
    for (const rawItem of Array.isArray(shipment.orderItems) ? shipment.orderItems : []) {
      const item = obj(rawItem);
      const orderId = str(item.orderId);
      const lineId = str(item.orderItemId) ?? str(item.id);
      const sku = str(item.sku);
      const quantity = typeof item.quantity === "number" ? item.quantity : Number(item.quantity);
      if (!orderId || !lineId || !sku || !Number.isFinite(quantity) || quantity <= 0) continue;
      const price = obj(item.priceComponents);
      lines.push({
        orderId,
        lineId,
        sku,
        quantity,
        locationExternalId: location,
        state,
        amountPaise: paiseFromRupees(price.sellingPrice ?? price.totalPrice),
        orderedAt: new Date(str(item.orderDate) ?? str(shipment.orderDate) ?? Date.now()),
      });
    }
  }
  const next = str(page.nextPageUrl);
  return { lines, next: page.hasMore === true && next ? next : null };
}

async function shipments(token: TokenSource, filter: Record<string, unknown>, state: OrderLineState): Promise<MarketplaceOrderLine[]> {
  const out: MarketplaceOrderLine[] = [];
  let page = linesFrom(await retryBusy(() => flipkartCall(token, "/v3/shipments/filter", { method: "POST", body: { filter } })), state);
  out.push(...page.lines);
  for (let i = 0; page.next && i < MAX_PAGES; i++) {
    // Flipkart's next page is a path under the API root; strip the root so the call adds it once.
    const path = new URL(page.next, `${HOST}/`).href.replace(HOST, "");
    page = linesFrom(await retryBusy(() => flipkartCall(token, path, { method: "GET" })), state);
    out.push(...page.lines);
  }
  return out;
}

/**
 * Orders waiting to ship, and ones cancelled since the cursor (inventory-sync D4): the shipment
 * search, allowed for our app (checked 2026-10-29, none pending then). Field names follow Flipkart's
 * documents and are read defensively; a line missing what we need is skipped, never guessed.
 */
export async function flipkartReadOrders(token: TokenSource, _account: string | null, cursor: string | null): Promise<OrdersPage> {
  const now = new Date();
  const since = cursor ?? new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
  const open = await shipments(token, { type: "preDispatch", states: OPEN_STATES }, ORDER_LINE_STATE.OPEN);
  const cancelled = await shipments(token, { type: "cancelled", states: ["CANCELLED"], cancellationDate: { from: since, to: now.toISOString() } }, ORDER_LINE_STATE.CANCELLED);
  // Ordered and dispatched between two checks (the worker was down): still a sale. This filter is
  // unconfirmed on a live order, so a refusal leaves the rest of the check standing.
  let dispatched: MarketplaceOrderLine[] = [];
  try {
    dispatched = await shipments(token, { type: "postDispatch", states: DISPATCHED_STATES, orderDate: { from: since, to: now.toISOString() } }, ORDER_LINE_STATE.SHIPPED);
  } catch (error) {
    if (!(error instanceof MarketplaceRequestError)) throw error;
    console.error("[channels] flipkart dispatched orders refused the filter");
  }
  return { lines: [...open, ...cancelled, ...dispatched], cursor: now.toISOString() };
}
