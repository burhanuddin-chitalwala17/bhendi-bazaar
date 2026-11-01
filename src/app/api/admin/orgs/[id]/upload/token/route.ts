/**
 * Permission for the team's browser to upload one of a shop's product photos or videos straight to
 * the object store (product-form D12; ADR-0028). The asset is the shop's, under the shop's folder,
 * with the admin as uploader — exactly as the shop's own route signs it.
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdminId } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { DomainError } from "@server/shared/domain-error";
import { mediaAssetService } from "@server/catalog/media-asset.service";
import { orgRepository } from "@server/catalog/org.repository";
import { presignUploadSchema } from "@/lib/validation/schemas/upload.schema";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const uploaderId = await requirePlatformAdminId();
    const { id: orgId } = await params;
    const org = await orgRepository.findSummary(orgId);
    if (!org) throw new DomainError("Shop not found", { status: 404 });
    const prefix = `org/${org.code.toLowerCase()}/`;
    const { pathname, contentType, size, contentHash, derivedFrom } = presignUploadSchema.parse(await request.json());
    // The schema rejects `.`/`..` segments, so a prefix test is containment here.
    if (!pathname.startsWith(prefix)) throw new DomainError(`Uploads must live under ${prefix}`);
    return NextResponse.json(
      await mediaAssetService.beginUpload({ orgId, uploaderId, pathname, contentType, size, contentHash, derivedFrom }),
    );
  } catch (error) {
    return toErrorResponse(error, "Could not authorise the upload");
  }
}
