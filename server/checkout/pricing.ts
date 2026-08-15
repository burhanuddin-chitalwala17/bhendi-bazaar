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
  price: number; // paise — the list price; reductions are offers (ADR-0018)
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
 * The catalogue price a line is priced from, before any offer.
 *
 * This used to resolve `Product.salePrice`. Markdowns are offers now (ADR-0018
 * decision 4), so there is one reduction mechanism rather than two, and the reduction
 * is applied by the offer engine against **this** base. Pricing from a
 * partly-discounted base is what made markdowns compound with campaigns instead of
 * competing with them (ADR-0019 decision 1).
 */
export function catalogueUnitPrice(product: Pick<PricingProduct, "price">): number {
  return product.price;
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

    const unit = catalogueUnitPrice(product);
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

    const unit = catalogueUnitPrice(product);
    itemsTotal += unit * quantity;
    lines.push({
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      thumbnail: product.thumbnail,
      price: product.price,
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
 * `discountPaise` comes from the offer engine, computed inside the same transaction
 * from persisted offers (ADR-0019). It is never accepted from a request: the browser
 * may contribute a coupon *code*, and a discount amount arriving in a body is an
 * attack rather than an input (Invariant 1).
 *
 * Shipping is outside the discount: offers reduce goods, and a parcel's rate is
 * quoted per origin, so discounting it would be discounting a courier's bill.
 */
export function assembleOrderTotals(
  groups: Array<{ itemsTotal: number; shippingRate: number }>,
  discountPaise = 0
): OrderTotals {
  const itemsTotal = groups.reduce((sum, g) => sum + g.itemsTotal, 0);
  const shippingTotal = groups.reduce((sum, g) => sum + g.shippingRate, 0);
  // Clamped so a mispriced offer can never make an order pay the customer.
  const discount = Math.max(0, Math.min(discountPaise, itemsTotal));
  return { itemsTotal, shippingTotal, discount, grandTotal: itemsTotal + shippingTotal - discount };
}
