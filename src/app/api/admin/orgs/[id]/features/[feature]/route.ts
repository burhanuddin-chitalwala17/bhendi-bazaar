/**
 * PUT /api/admin/orgs/[id]/features/[feature] — switch one paid feature for one shop
 * (subscriptions/feature-access D12). Platform admin only; audited in the service.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdminId } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { orgFeatureSwitchSchema } from "@/lib/validation/schemas/org-feature.schema";
import { featureAccessService } from "@server/subscriptions/feature-access.service";
import { isFeature } from "@server/subscriptions/feature-access.types";
import { NotFoundError } from "@server/shared/domain-error";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string; feature: string }> }) {
  try {
    const adminId = await requirePlatformAdminId();
    const { id, feature } = await context.params;
    if (!isFeature(feature)) throw new NotFoundError("Feature not found");
    const { enabled } = orgFeatureSwitchSchema.parse(await request.json());
    return NextResponse.json({ switch: await featureAccessService.set(adminId, id, feature, enabled) });
  } catch (error) {
    return toErrorResponse(error, "Could not change this feature");
  }
}
