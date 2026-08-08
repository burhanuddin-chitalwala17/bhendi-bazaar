import { cache } from "react";
import { adminOrderRepository } from "@server/checkout/admin.order.repository";
import type { OrderAddress } from "@/domain/order";
import type { ShipmentItem } from "@server/checkout/order.types";

/**
 * What an org may know about an order it part-fulfils. Deliberately absent, and kept
 * absent by `toOrgOrderView` below: the basket's other shipments and every order-level
 * money figure (`grandTotal`, `itemsTotal`) — those describe the buyer's whole basket,
 * which is not this vendor's business. The delivery address IS included: they are the
 * ones shipping to it. `paymentStatus` is included so nothing unpaid gets fulfilled.
 */
export interface OrgShipmentView {
  id: string;
  code: string;
  status: string;
  shippingCost: number;
  items: ShipmentItem[];
  courierName?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  fromPincode?: string;
  fromCity?: string;
}

export interface OrgOrderView {
  id: string;
  code: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
  address: OrderAddress;
  notes?: string | null;
  shipments: OrgShipmentView[];
  /** Sum over this org's items only — never the basket's total. */
  parcelValue: number;
  itemCount: number;
}

type OrderRow = {
  id: string;
  code: string;
  status: string;
  paymentStatus: string | null;
  createdAt: Date;
  address: unknown;
  notes?: string | null;
  shipments: Array<{
    id: string;
    code: string;
    status: string;
    items: unknown;
    shippingCost: number;
    orgId?: string;
    courierName?: string | null;
    trackingNumber?: string | null;
    trackingUrl?: string | null;
    fromPincode?: string;
    fromCity?: string;
  }>;
};

/**
 * Pure, and exported for tests: the query already fetches only this org's shipments,
 * but the no-leak property is asserted here a second time so it is testable without a
 * database — a row containing a foreign shipment loses it in the mapping.
 */
export function toOrgOrderView(order: OrderRow, orgId: string): OrgOrderView {
  const shipments = order.shipments
    .filter((s) => s.orgId === undefined || s.orgId === orgId)
    .map((s) => ({
      id: s.id,
      code: s.code,
      status: s.status,
      shippingCost: s.shippingCost,
      items: (Array.isArray(s.items) ? s.items : []) as ShipmentItem[],
      courierName: s.courierName ?? null,
      trackingNumber: s.trackingNumber ?? null,
      trackingUrl: s.trackingUrl ?? null,
      fromPincode: s.fromPincode,
      fromCity: s.fromCity,
    }));

  const items = shipments.flatMap((s) => s.items);

  return {
    id: order.id,
    code: order.code,
    status: order.status,
    paymentStatus: order.paymentStatus ?? "pending",
    createdAt: order.createdAt.toISOString(),
    address: order.address as OrderAddress,
    notes: order.notes ?? null,
    shipments,
    parcelValue: items.reduce((sum, i) => sum + (i.salePrice ?? i.price) * i.quantity, 0),
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
  };
}

class OrgOrdersDAL {
  getOrders = cache(async (orgId: string, page = 1) => {
    const { orders, total, limit } = await adminOrderRepository.getOrdersForOrg(orgId, page);
    return {
      orders: orders.map((o) => toOrgOrderView(o, orgId)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });

  getOrder = cache(async (orderId: string, orgId: string) => {
    const order = await adminOrderRepository.getOrderForOrg(orderId, orgId);
    return order ? toOrgOrderView(order, orgId) : null;
  });
}

export const orgOrdersDAL = new OrgOrdersDAL();
