/**
 * Admin Order Service
 * Business logic for order management
 */

import { adminOrderRepository } from "@server/checkout/admin.order.repository";
import { recordAdminAction } from "@server/shared/audit/audit.service";
import type {
  OrderListFilters,
  OrderListResult,
  UpdateOrderStatusInput,
  OrderStats,
} from "@server/checkout/admin.order.types";
import { DomainError } from "@server/shared/domain-error";

const VALID_ORDER_STATUSES = ["processing", "packed", "shipped", "delivered"];

export class AdminOrderService {
  /**
   * Get paginated list of orders
   */
  async getOrders(filters: OrderListFilters): Promise<OrderListResult> {
    const { orders, total } = await adminOrderRepository.getOrders(filters);

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const totalPages = Math.ceil(total / limit);

    return {
      orders,
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

  /**
   * Update order status
   */
  async updateOrderStatus(
    id: string,
    adminId: string,
    data: UpdateOrderStatusInput
  ) {
    // Validate status if provided
    if (data.status && !VALID_ORDER_STATUSES.includes(data.status)) {
      throw new DomainError(`Invalid status. Must be one of: ${VALID_ORDER_STATUSES.join(", ")}`);
    }

    const order = await adminOrderRepository.updateOrderStatus(id, data);

    if (order) {
      await recordAdminAction({
        adminId,
        action: "ORDER_UPDATED",
        resource: "Order",
        resourceId: id,
        metadata: { changes: data },
      });
    }

    return order;
  }

  /**
   * Bulk update order status
   */
  async bulkUpdateStatus(
    orderIds: string[],
    status: string,
    adminId: string
  ): Promise<number> {
    if (!VALID_ORDER_STATUSES.includes(status)) {
      throw new DomainError(`Invalid status. Must be one of: ${VALID_ORDER_STATUSES.join(", ")}`);
    }

    const count = await adminOrderRepository.bulkUpdateStatus(orderIds, status);

    await recordAdminAction({
      adminId,
      action: "ORDERS_BULK_UPDATED",
      resource: "Order",
      resourceId: orderIds.join(","),
      metadata: { status, count },
    });

    return count;
  }

  /**
   * Get order statistics
   */
  async getOrderStats(): Promise<OrderStats> {
    return await adminOrderRepository.getOrderStats();
  }
}

export const adminOrderService = new AdminOrderService();


