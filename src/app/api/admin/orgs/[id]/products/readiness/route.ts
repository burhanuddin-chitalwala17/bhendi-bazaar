/**
 * POST /api/admin/orgs/[id]/products/readiness — the shop's readiness hints for the team's form
 * (product-form D4, D12). Writes nothing; the shop is the path's.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { DomainError } from "@server/shared/domain-error";
import { channelReadinessService } from "@server/listing/channel-readiness.service";
import { productReadinessSchema } from "@/lib/validation/schemas/product.schema";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdmin();
    const { id: orgId } = await params;
    const raw = await request.json().catch(() => {
      throw new DomainError("The request body is not valid JSON");
    });
    return NextResponse.json(await channelReadinessService.forUnsaved(orgId, productReadinessSchema.parse(raw)));
  } catch (error) {
    return toErrorResponse(error, "Could not check readiness");
  }
}
