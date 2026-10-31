// src/data-access-layer/orders.dal.ts

import { optionalActiveSession } from "@/lib/admin-auth";
import { unstable_rethrow } from "next/navigation";
import { orderService } from "@server/checkout/order.service";
import { Order, Shipment } from "@/domain/order";
import { OrderAddress } from "@/domain/order";

/** One row → the client-facing shape, shared by both reads below. */
function toOrder(row: Awaited<ReturnType<typeof orderService.getOrderById>>): Order {
  return {
    id: row.id,
    code: row.code,
    itemsTotal: row.itemsTotal,
    shippingTotal: row.shippingTotal,
    discount: row.discount,
    grandTotal: row.grandTotal,
    status: row.status,
    address: row.address as unknown as OrderAddress,
    notes: row.notes as string,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    paymentMethod: row.paymentMethod as string,
    paymentStatus: row.paymentStatus as string,
    paymentId: row.paymentId as string,
    shipments: row.shipments as unknown as Shipment[],
  };
}

export const ordersDAL = {
  /**
   * The signed-in viewer's orders, read on the server.
   *
   * Session is read here rather than by the page, matching `wishlist.dal.ts`: the
   * question is "what has *this* viewer bought", so plumbing a user id through the page
   * would only move the same read. A guest has no order history by design and gets an
   * empty list — the page decides that means the lookup-by-code form.
   */
  listForViewer: async (): Promise<Order[]> => {
    try {
      const session = await optionalActiveSession({ onBlocked: "allow" });
      if (!session?.user?.id) return [];
      const rows = await orderService.getOrdersByUserId(session.user.id);
      return rows.map((row) => toOrder(row as Parameters<typeof toOrder>[0]));
    } catch (error) {
      // Reading the session marks the route dynamic by throwing; that is Next's control
      // flow, not a failure.
      unstable_rethrow(error);
      console.error("Failed to fetch orders:", error);
      return [];
    }
  },

  getOrderById: async (id: string, viewerUserId?: string): Promise<Order | null> => {
    try {
      // viewerUserId enforces ownership for registered-user orders: the service throws
      // ForbiddenError when the order belongs to a different user. Guest orders
      // (order.userId null) are still readable by id here — closing that requires an
      // order-scoped access token in the post-checkout URL, a product decision tracked
      // separately (checkout/CLAUDE.md: "decide explicitly what a guest order permits").
      const order = await orderService.getOrderById(id, viewerUserId);
      if (!order) {
        return null;
      }
      return toOrder(order);
    } catch (error) {
      console.error("Failed to fetch order:", error);
      return null;
    }
  },
};