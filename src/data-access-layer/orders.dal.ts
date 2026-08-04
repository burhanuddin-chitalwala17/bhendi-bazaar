// src/data-access-layer/orders.dal.ts

import { orderService } from "@server/checkout/order.service";
import { Order, Shipment } from "@/domain/order";
import { OrderAddress } from "@/domain/order";

export const ordersDAL = { 
  getOrderById: async (id: string): Promise<Order | null> => {
    try {
      const order = await orderService.getOrderById(id);
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