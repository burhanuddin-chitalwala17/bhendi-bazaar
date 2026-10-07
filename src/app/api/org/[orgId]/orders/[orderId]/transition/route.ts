import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withOrg } from "@/lib/org-auth";
import { adminOrderService } from "@server/checkout/admin.order.service";
import { ORDER_STATUS } from "@server/checkout/order.types";

const transitionSchema = z.object({
  status: z.enum([ORDER_STATUS.PACKED]),
});

export const PATCH = withOrg<{ orgId: string; orderId: string }>(
  async (request: NextRequest, scope, params) => {
    const body = await request.json();
    const { status } = transitionSchema.parse(body);

    await adminOrderService.transitionForOrg(params.orderId, scope.orgId, status);

    return NextResponse.json({ ok: true });
  },
);
