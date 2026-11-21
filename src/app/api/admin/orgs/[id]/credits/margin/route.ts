/**
 * PUT /api/admin/orgs/[id]/credits/margin — this shop's margin on AI pictures, or null to follow the
 * platform's (ai-images/shop-credits R6, Q15). Affects only charges made afterwards.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdminId } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { marginSchema } from "@/lib/validation/schemas/credit.schema";
import { creditService } from "@server/payouts/credit.service";
import { adminOrgService } from "@server/catalog/org.service";
import { NotFoundError } from "@server/shared/domain-error";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const adminId = await requirePlatformAdminId();
    const { id } = await context.params;
    const [org] = await adminOrgService.summariesFor([id]);
    if (!org) throw new NotFoundError("Shop not found");
    const { marginBps } = marginSchema.parse(await request.json());
    await creditService.setOrgMargin(id, marginBps, adminId);
    return NextResponse.json(await creditService.adminAccount(id));
  } catch (error) {
    return toErrorResponse(error, "Could not change the margin");
  }
}
