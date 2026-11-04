/**
 * Admin Order Service
 * Business logic for order management
 */

import { adminOrderRepository } from "@server/checkout/admin.order.repository";
import { ORDER_EXPORT_CAP, ordersCsv } from "@server/checkout/order-export";
import { recordAdminActionIn } from "@server/shared/audit/audit.service";
import { DomainError } from "@server/shared/domain-error";
import { prisma } from "@server/shared/prisma";
import type {
  OrderAddressSnapshot,
  OrderListFilters,
  OrderListResult,
  OrderStats,
} from "@server/checkout/admin.order.types";

/** The audit trail's name for an export of buyers' details. */
export const ORDERS_EXPORTED = "ORDERS_EXPORTED";

export class AdminOrderService {
  /**
   * A view of the orders as CSV, for a platform admin (design-system Q37). The file holds buyers'
   * names, phones and addresses, so the trail is written first and must land: no entry, no file.
   */
  async exportOrders(
    adminId: string,
    view: Pick<OrderListFilters, "search" | "status" | "paymentStatus" | "sortBy" | "sortOrder">,
  ): Promise<{ csv: string; count: number }> {
    const rows = await adminOrderRepository.exportRows(view, ORDER_EXPORT_CAP);
    if (rows.length > ORDER_EXPORT_CAP) {
      throw new DomainError(
        `This view has more than ${ORDER_EXPORT_CAP.toLocaleString("en-IN")} orders. Narrow it with a status, payment or search, then export again.`,
        { status: 422 },
      );
    }
    await recordAdminActionIn(prisma, {
      adminId,
      action: ORDERS_EXPORTED,
      resource: "Order",
      resourceId: "export",
      metadata: { view, count: rows.length },
    });
    return { csv: ordersCsv(rows), count: rows.length };
  }


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


