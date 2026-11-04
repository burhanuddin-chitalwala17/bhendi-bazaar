/**
 * GET /api/admin/orders/export — the orders list's current view as CSV (design-system Q37).
 * The same query the page reads, parsed by the same schema; the file is a download, so the
 * page's Export CSV is a plain link and no client code is involved.
 */
import { NextRequest, NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { adminOrderViewSchema } from "@/lib/validation/schemas/admin-order-list.schema";
import { adminOrderService } from "@server/checkout/admin.order.service";
import { indiaToday } from "@server/shared/india-time";

export async function GET(request: NextRequest) {
  try {
    const session = await requirePlatformAdmin();
    const view = adminOrderViewSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const { csv } = await adminOrderService.exportOrders(session.user.id, view);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="bhendi-bazaar-orders-${indiaToday()}.csv"`,
        // Buyers' details: never kept by a browser or proxy cache.
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return toErrorResponse(error, "Could not export orders");
  }
}
