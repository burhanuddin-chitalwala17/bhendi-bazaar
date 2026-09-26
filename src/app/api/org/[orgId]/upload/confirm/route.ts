/**
 * POST /api/org/[orgId]/upload/confirm — the bytes have landed; make the asset record true
 * (media-library trd D2). Called by the browser uploader right after its PUT.
 */
import { NextResponse } from "next/server";
import { withOrg } from "@/lib/org-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { mediaAssetService } from "@server/catalog/media-asset.service";
import { confirmUploadSchema } from "@/lib/validation/schemas/upload.schema";

export const POST = withOrg<{ orgId: string }>(async (request, scope) => {
  try {
    const { assetId, width, height } = confirmUploadSchema.parse(await request.json());
    return NextResponse.json(
      await mediaAssetService.confirmUpload({ assetId, orgId: scope.orgId, width, height }),
    );
  } catch (error) {
    return toErrorResponse(error, "Could not confirm the upload");
  }
});
