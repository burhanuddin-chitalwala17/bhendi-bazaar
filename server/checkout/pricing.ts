import { DomainError, NotFoundError } from "@server/shared/domain-error";
import type { ShipmentItem } from "@server/checkout/order.types";

/**
 * The server's answer to "what does this order cost" (Invariant 1, ADR-0002).
 *
 * Pure functions over rows the caller loaded inside the order transaction, so the
 * price used for the total is the price checked against the catalogue — and so every
 * branch here is unit-testable without a database. The request contributes product
 * ids and quantities; every rupee figure and every display field comes from the
 * catalogue row.
 */

/** What pricing needs from a Product row. */
export interface PricingProduct {
  id: string;
  name: string;
  slug: string;
  thumbnail: string;
  price: number; // paise
  salePrice: number | null; // paise
  weight: number | null; // kg
  orgId: string;
  sizes: string[];
  colors: string[];
}

export interface UnpricedItem {
  productId: string;
  quantity: number;
  /** The chosen variant — checked against the product's declared options. */
  size?: string;
  color?: string;
}

/** A wire line plus the figure the order line persists (order-and-cart-lines D2). */
export type PricedLine = ShipmentItem & { unitPrice: number };

export interface PricedGroup {
  items: PricedLine[];
  itemsTotal: number; // paise
  totalWeight: number; // kg
}

/**
 * The one place the sale-price rule lives (trd.md D6): a sale price applies when it
 * is set, positive, and actually below the regular price.
 */
export function effectiveUnitPrice(product: Pick<PricingProduct, "price" | "salePrice">): number {
  const { price, salePrice } = product;
  return salePrice !== null && salePrice > 0 && salePrice < price ? salePrice : price;
}

/** Price one shipment group's items from the catalogue. */
export function priceGroupItems(
  items: UnpricedItem[],
  products: Map<string, PricingProduct>,
  groupOrgId: string
): PricedGroup {
  const priced: PricedLine[] = [];
  let itemsTotal = 0;
  let totalWeight = 0;

  for (const { productId, quantity, size, color } of items) {
    const product = products.get(productId);
    if (!product) {
      // Fails the whole transaction: an order must never persist a line the
      // catalogue cannot answer for.
      throw new NotFoundError("One of the items in your order is no longer available");
    }
    if (product.orgId !== groupOrgId) {
      // The parcel would be attributed (and its revenue owed) to the wrong org.
      throw new DomainError("An item in this order does not belong to the shipping organisation");
    }
    // The order line records which size to pack (order-and-cart-lines D5); a variant
    // the product never offered would be an unfulfillable instruction.
    if (size && !product.sizes.includes(size)) {
      throw new DomainError(`"${product.name}" is not available in size ${size}`);
    }
    if (color && !product.colors.includes(color)) {
      throw new DomainError(`"${product.name}" is not available in ${color}`);
    }

    const unit = effectiveUnitPrice(product);
    itemsTotal += unit * quantity;
    totalWeight += (product.weight ?? 0) * quantity;

    // Display fields come from the catalogue too — a client-sent name or thumbnail
    // on a persisted order line would be spoofable history.
    priced.push({
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      thumbnail: product.thumbnail,
      price: product.price,
      salePrice: product.salePrice ?? undefined,
      quantity,
      size,
      color,
      unitPrice: unit,
    });
  }

  return { items: priced, itemsTotal, totalWeight };
}

/**
 * Price order lines from the catalogue, with no grouping: since stock-locations,
 * which parcel a line ships in is the allocation's decision, not the request's —
 * so org attribution is checked there (a parcel's org is its location's org by
 * construction), and pricing is purely per line.
 */
export function priceLines(
  items: UnpricedItem[],
  products: Map<string, PricingProduct>
): { lines: PricedLine[]; itemsTotal: number } {
  const lines: PricedLine[] = [];
  let itemsTotal = 0;

  for (const { productId, quantity, size, color } of items) {
    const product = products.get(productId);
    if (!product) {
      throw new NotFoundError("One of the items in your order is no longer available");
    }
    if (size && !product.sizes.includes(size)) {
      throw new DomainError(`"${product.name}" is not available in size ${size}`);
    }
    if (color && !product.colors.includes(color)) {
      throw new DomainError(`"${product.name}" is not available in ${color}`);
    }

    const unit = effectiveUnitPrice(product);
    itemsTotal += unit * quantity;
    lines.push({
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      thumbnail: product.thumbnail,
      price: product.price,
      salePrice: product.salePrice ?? undefined,
      quantity,
      size,
      color,
      unitPrice: unit,
    });
  }

  return { lines, itemsTotal };
}

export interface OrderTotals {
  itemsTotal: number;
  shippingTotal: number;
  discount: number;
  grandTotal: number;
}

/**
 * Assemble order totals from server-priced groups.
 *
 * `discount` is a constant 0: no discount mechanism exists, so any client-sent
 * discount is an attack, not an input. When coupons arrive, the amount is computed
 * here from the coupon — never accepted from the request.
 */
export function assembleOrderTotals(
  groups: Array<{ itemsTotal: number; shippingRate: number }>
): OrderTotals {
  const itemsTotal = groups.reduce((sum, g) => sum + g.itemsTotal, 0);
  const shippingTotal = groups.reduce((sum, g) => sum + g.shippingRate, 0);
  const discount = 0;
  return { itemsTotal, shippingTotal, discount, grandTotal: itemsTotal + shippingTotal - discount };
}
