/**
 * PUT /api/admin/orgs/[id]/credits/margin — this shop's margin on AI pictures, or null to follow the
 * platform's (ai-images/shop-credits R6, Q15). Affects only charges made afterwards.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdminId } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { marginSchema } from "@/lib/validation/schemas/credit.schema";
import { creditService } from "@server/payouts/credit.service";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdminId();
    const { id } = await context.params;
    const { marginBps } = marginSchema.parse(await request.json());
    await creditService.setOrgMargin(id, marginBps);
    return NextResponse.json(await creditService.adminAccount(id));
  } catch (error) {
    return toErrorResponse(error, "Could not change the margin");
  }
}
