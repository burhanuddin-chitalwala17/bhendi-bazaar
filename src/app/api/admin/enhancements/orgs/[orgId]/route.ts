/**
 * PUT /api/admin/enhancements/orgs/[orgId] — what one shop does differently.
 *
 * An allowance of its own, a pause with the reason its members will read, or neither — and
 * neither means the row is deleted rather than left holding a copy of the platform's number
 * (image-enhancement spec R7, A5; trd D5). Recorded in the audit trail (ADR-0021).
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdminId } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { enhancementService } from "@server/content/enhancement.service";
import { recordAdminAction } from "@server/shared/audit/audit.service";
import { orgEnhancementPolicySchema } from "@/lib/validation/schemas/enhancement.schema";

export async function PUT(request: NextRequest, context: { params: Promise<{ orgId: string }> }) {
  try {
    const adminId = await requirePlatformAdminId();
    const { orgId } = await context.params;
    const body = orgEnhancementPolicySchema.parse(await request.json());
    const policy = await enhancementService.setOrgPolicy(orgId, body);
    await recordAdminAction({
      adminId,
      action: "enhancement.org-policy.update",
      resource: "org",
      resourceId: orgId,
      metadata: {
        monthlyAllowance: body.monthlyAllowance,
        paused: body.paused,
        pauseReason: body.pauseReason,
      },
    });
    return NextResponse.json({ policy });
  } catch (error) {
    return toErrorResponse(error, "Could not save this shop's enhancement policy");
  }
}
