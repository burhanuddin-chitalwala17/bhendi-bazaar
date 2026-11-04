import type { ProductListScope } from "@/lib/validation/schemas/product-list.schema";
import {
  BULK_ACTION,
  BULK_PRICE_MODE,
  BULK_SKIP_REASON,
  type BulkPriceChange,
  type BulkPriceMode,
  type BulkSkipReason,
  type BulkStockRow,
} from "@server/catalog/product-bulk.types";
import type { BulkProductActionInput } from "@/lib/validation/schemas/product-bulk.schema";

/** Up or down, for a change by an amount or a percentage. */
export const DIRECTION = { UP: "up", DOWN: "down" } as const;
export type Direction = (typeof DIRECTION)[keyof typeof DIRECTION];

const TWO_DECIMALS = /^\d+(\.\d{1,2})?$/;

/**
 * "1,250.5" → 125050. Parsed from the digits, never `rupees * 100`: 1200.29 * 100 is 120028.99… in
 * IEEE754, and money crosses the wire as integer paise (Invariant 3). Null when it is not an amount.
 */
export function rupeesTextToPaise(text: string): number | null {
  const clean = text.trim().replace(/,/g, "").replace(/^₹\s*/, "");
  if (!TWO_DECIMALS.test(clean)) return null;
  const [whole, fraction = ""] = clean.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export type PriceDraft = { mode: BulkPriceMode; direction: Direction; text: string };

/** The change a price draft asks for, or the plain reason it cannot be sent yet. */
export function priceChangeFrom(draft: PriceDraft): { ok: true; change: BulkPriceChange } | { ok: false; message: string } {
  const sign = draft.direction === DIRECTION.DOWN ? -1 : 1;
  if (draft.mode === BULK_PRICE_MODE.PERCENT) {
    const clean = draft.text.trim().replace(/%$/, "");
    if (!TWO_DECIMALS.test(clean) || Number(clean) === 0) return { ok: false, message: "Enter a percentage, like 10 or 12.5" };
    return { ok: true, change: { mode: BULK_PRICE_MODE.PERCENT, percent: sign * Number(clean) } };
  }
  const paise = rupeesTextToPaise(draft.text);
  if (paise === null || paise === 0) return { ok: false, message: "Enter an amount in rupees, like 1250 or 99.50" };
  if (draft.mode === BULK_PRICE_MODE.SET) return { ok: true, change: { mode: BULK_PRICE_MODE.SET, pricePaise: paise } };
  return { ok: true, change: { mode: BULK_PRICE_MODE.AMOUNT, deltaPaise: sign * paise } };
}

/** Which products an action names: picked by id, or every one the list's filters match (Q35). */
export type BulkTargetSet = { productIds: string[] } | { matching: ProductListScope };

export function priceAction(target: string[] | BulkTargetSet, change: BulkPriceChange): BulkProductActionInput {
  return { action: BULK_ACTION.PRICE, ...(Array.isArray(target) ? { productIds: target } : target), change };
}

/** A product as the stock editor needs it: each location's count as the list read it. */
export interface StockProduct {
  id: string;
  stockByLocation: ReadonlyArray<{ orgAddressId: string; quantity: number }>;
}

/** What this list read at a location; 0 where the product holds no row there. */
export function seenAt(product: StockProduct, orgAddressId: string): number {
  return product.stockByLocation.find((row) => row.orgAddressId === orgAddressId)?.quantity ?? 0;
}

/** The key of one product at one location in the editor's draft. */
export const cellKey = (productId: string, orgAddressId: string) => `${productId}:${orgAddressId}`;

/**
 * The rows to send: only cells the editor changed, each carrying what it saw, so the server's
 * compare-and-set refuses a count that moved underneath (Invariant 6). Null when a cell is not a
 * whole number of zero or more.
 */
export function stockRowsFrom(
  products: readonly StockProduct[],
  locationIds: readonly string[],
  draft: Readonly<Record<string, string>>,
): BulkStockRow[] | null {
  const rows: BulkStockRow[] = [];
  for (const product of products) {
    for (const orgAddressId of locationIds) {
      const text = draft[cellKey(product.id, orgAddressId)];
      if (text === undefined) continue;
      if (!/^\d+$/.test(text.trim())) return null;
      const quantity = Number(text.trim());
      const seenQuantity = seenAt(product, orgAddressId);
      if (quantity !== seenQuantity) rows.push({ productId: product.id, orgAddressId, quantity, seenQuantity });
    }
  }
  return rows;
}

/** Why a product was left as it was, in the shop's words. */
export const SKIP_REASON_COPY: Record<BulkSkipReason, string> = {
  [BULK_SKIP_REASON.NOT_FOUND]: "No longer in this shop",
  [BULK_SKIP_REASON.ARCHIVED]: "Archived: restore it first",
  [BULK_SKIP_REASON.ALREADY_ARCHIVED]: "Already archived",
  [BULK_SKIP_REASON.UNCHANGED]: "Already at that value",
  [BULK_SKIP_REASON.PRICE_TOO_LOW]: "The new price would be ₹0 or less",
  [BULK_SKIP_REASON.PRICE_TOO_HIGH]: "The new price would be too high",
  [BULK_SKIP_REASON.BIDDING_LIVE]: "In a live auction",
  [BULK_SKIP_REASON.LOCATION_NOT_FOUND]: "That pickup address is not this product's shop's",
  [BULK_SKIP_REASON.NOT_ON_MARKETPLACE]: "Not listed on that marketplace yet",
  [BULK_SKIP_REASON.NOTHING_TO_SEND]: "Already up to date there",
  [BULK_SKIP_REASON.SEND_IN_PROGRESS]: "Already on its way",
};
