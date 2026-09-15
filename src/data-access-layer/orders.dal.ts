// src/data-access-layer/orders.dal.ts

import { orderService } from "@server/checkout/order.service";
import { Order, Shipment } from "@/domain/order";
import { OrderAddress } from "@/domain/order";

export const ordersDAL = {
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
      return {
        id: order.id,
        code: order.code,
        itemsTotal: order.itemsTotal,
        shippingTotal: order.shippingTotal,
        discount: order.discount,
        grandTotal: order.grandTotal,
        status: order.status,
        address: order.address as unknown as OrderAddress,
        notes: order.notes as string,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        paymentMethod: order.paymentMethod as string,
        paymentStatus: order.paymentStatus as string,
        paymentId: order.paymentId as string,
        shipments: order.shipments as unknown as Shipment[],
      }
    } catch (error) {
      console.error("Failed to fetch order:", error);
      return null;
    }
  },
};