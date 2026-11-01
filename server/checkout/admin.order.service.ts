/**
 * Admin Order Service
 * Business logic for order management
 */

import { adminOrderRepository } from "@server/checkout/admin.order.repository";
import { orderRepository } from "@server/checkout/order.repository";
import { recordAdminAction } from "@server/shared/audit/audit.service";
import type {
  OrderAddressSnapshot,
  OrderListFilters,
  OrderListResult,
  UpdateOrderStatusInput,
  OrderStats,
} from "@server/checkout/admin.order.types";
import { ORDER_STATUS, OPERATOR_SETTABLE_STATUSES, type OrderStatus } from "@server/checkout/order.types";
import { DomainError } from "@server/shared/domain-error";

const isOperatorSettable = (status: string): status is OrderStatus =>
  (OPERATOR_SETTABLE_STATUSES as readonly string[]).includes(status);

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

  /**
   * An operator's edit: a fulfilment move, notes, or both. The move is conditional on the
   * transition table (`orderRepository.transition`), so a stale dropdown is refused with where
   * the order actually is rather than overwriting it. The audit record stays — it records the
   * action, it never decides it (ADR-0021).
   */
  async updateOrderStatus(
    id: string,
    adminId: string,
    data: UpdateOrderStatusInput
  ) {
    if (data.status !== undefined) {
      if (!isOperatorSettable(data.status)) {
        throw new DomainError(
          `Invalid status. Must be one of: ${OPERATOR_SETTABLE_STATUSES.join(", ")}`,
          { field: "status" },
        );
      }
      await orderRepository.transition(id, data.status);
    }
    if (data.notes !== undefined) {
      await orderRepository.setNotes(id, data.notes);
    }

    await recordAdminAction({
      adminId,
      action: "ORDER_UPDATED",
      resource: "Order",
      resourceId: id,
      metadata: { changes: data },
    });

    return true;
  }

  async getOrderStats(): Promise<OrderStats> {
    return await adminOrderRepository.getOrderStats();
  }
}

export const adminOrderService = new AdminOrderService();


