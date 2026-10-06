/**
 * The one thing the orders console asks the browser to do: move an order's status. No reads —
 * the listing and detail screen are server components reading through `adminOrdersDAL` ([ADR-0034]).
 */

import { apiRequest } from "@/lib/api-client";
import type { Order } from "@/domain/order";

export const adminOrderApiClient = {
  updateOrderStatus(id: string, data: { status?: string; notes?: string }): Promise<Order> {
    return apiRequest(`/api/admin/orders/${id}`, { method: "PATCH", body: data });
  },
};
