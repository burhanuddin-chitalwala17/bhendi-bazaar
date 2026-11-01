/**
 * POST /api/admin/orgs/[id]/upload/confirm — a shop's asset the team uploaded has landed
 * (product-form D12; media-library trd D2).
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { mediaAssetService } from "@server/catalog/media-asset.service";
import { confirmUploadSchema } from "@/lib/validation/schemas/upload.schema";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdmin();
    const { id: orgId } = await params;
    const { assetId, width, height } = confirmUploadSchema.parse(await request.json());
    return NextResponse.json(await mediaAssetService.confirmUpload({ assetId, orgId, width, height }));
  } catch (error) {
    return toErrorResponse(error, "Could not confirm the upload");
  }
}
