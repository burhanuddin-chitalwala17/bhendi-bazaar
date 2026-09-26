/**
 * POST /api/admin/upload/confirm — the platform's own uploads, confirmed after the PUT
 * (media-library trd D2). Called by the browser uploader after its PUT.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { mediaAssetService } from "@server/catalog/media-asset.service";
import { confirmUploadSchema } from "@/lib/validation/schemas/upload.schema";

export async function POST(request: NextRequest) {
  try {
    await requirePlatformAdmin();
    const { assetId, width, height } = confirmUploadSchema.parse(await request.json());
    return NextResponse.json(
      await mediaAssetService.confirmUpload({ assetId, orgId: null, width, height }),
    );
  } catch (error) {
    return toErrorResponse(error, "Could not confirm the upload");
  }
}
