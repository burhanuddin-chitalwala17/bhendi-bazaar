/**
 * The one thing the orders console asks the browser to do: move an order's status.
 *
 * No reads. Both the listing and the detail screen are server components reading through
 * `adminOrdersDAL` ([ADR-0034]), so `getOrders` and `getOrderById` were round trips for data
 * those pages already had.
 */

import type { Order } from "@/domain/order";
import { readApiError } from "@/lib/api-error";

class AdminOrderService {
  async updateOrderStatus(id: string, data: { status?: string; notes?: string }): Promise<Order> {
    const response = await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw await readApiError(response);
    return response.json();
  }
}

export const adminOrderApiClient = new AdminOrderService();
