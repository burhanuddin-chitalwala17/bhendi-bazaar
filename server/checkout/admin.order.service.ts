/**
 * Admin Order Service
 * Business logic for order management
 */

import { adminOrderRepository } from "@server/checkout/admin.order.repository";
import type {
  OrderAddressSnapshot,
  OrderListFilters,
  OrderListResult,
  OrderStats,
} from "@server/checkout/admin.order.types";

export class AdminOrderService {
  /** Visible orders by status, for the console's tabs. */
  countByStatus(): Promise<Record<string, number>> {
    return adminOrderRepository.countByStatus();
  }

  /**
   * Get paginated list of orders
   */
  async getOrders(filters: OrderListFilters): Promise<OrderListResult> {
    const { orders, total } = await adminOrderRepository.getOrders(filters);

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const totalPages = Math.ceil(total / limit);

    return {
      orders: orders.map((order) => ({
        id: order.id,
        code: order.code,
        customerName: (order.address as OrderAddressSnapshot | null)?.fullName ?? null,
        grandTotal: order.grandTotal,
        status: order.status,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
      })),
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Get single order by ID
   */
  async getOrderById(id: string){
    return await adminOrderRepository.getOrderById(id);
  }

  async getOrderStats(): Promise<OrderStats> {
    return await adminOrderRepository.getOrderStats();
  }
}

export const adminOrderService = new AdminOrderService();


