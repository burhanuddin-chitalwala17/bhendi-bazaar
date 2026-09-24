// DATA ACCESS LAYER FOR ADMIN ORDERS

import { cache } from "react";
import { adminOrderService } from "@server/checkout/admin.order.service";
import type {
  AdminOrderDetail,
  OrderListFilters,
  OrderListResult,
} from "@server/checkout/admin.order.types";

/**
 * The console's orders, read on the server
 * ([ADR-0034](../../../docs/adr/0034-render-on-the-server-by-default.md)). Memoised per
 * request, like the other admin DALs.
 */
class OrdersDAL {
  list = cache(async (filters: OrderListFilters): Promise<OrderListResult> => {
    return adminOrderService.getOrders(filters);
  });

  detail = cache(async (id: string): Promise<AdminOrderDetail | null> => {
    return adminOrderService.getOrderById(id);
  });
}

export const adminOrdersDAL = new OrdersDAL();
