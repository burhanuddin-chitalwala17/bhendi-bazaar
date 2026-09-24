/**
 * PATCH /api/admin/orders/[id] — update an order's status, from the list's status control.
 *
 * There is no GET. The detail screen is a server component reading through `adminOrdersDAL`,
 * so a handler answering the same question was a round trip for data the page already had
 * ([ADR-0034]).
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { adminOrderService } from "@server/checkout/admin.order.service";
import { toErrorResponse } from "@/lib/api-error-response";
import { updateOrderStatusSchema } from "@/lib/validation/schemas/admin.schemas";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requirePlatformAdmin();
    const { id } = await params;
    const body = updateOrderStatusSchema.parse(await request.json());

    const order = await adminOrderService.updateOrderStatus(
      id,
      session.user.id,
      body,
    );

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    return toErrorResponse(error, "Could not update order:");
  }
}
