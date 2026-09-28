/**
 * POST /api/admin/media/:assetId/retire — the platform taking an image down over a breach.
 *
 * The only write the platform owner has into anybody's library (media-library spec R12, trd
 * D10): everything else on that screen is the org's own listing query, read-only. The reason
 * is required, stored on the asset so the org can read it without an admin to ask, and
 * recorded in the audit trail by the service, which never fails the action (ADR-0021).
 */
import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdminId } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { mediaAssetService } from "@server/catalog/media-asset.service";
import { platformRetireSchema } from "@/lib/validation/schemas/media-library.schema";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assetId: string }> },
) {
  try {
    const adminId = await requirePlatformAdminId();
    const { assetId } = await params;
    const { reason } = platformRetireSchema.parse(await request.json());
    return NextResponse.json(await mediaAssetService.retireAsPlatform(adminId, assetId, reason));
  } catch (error) {
    return toErrorResponse(error, "Failed to take this image down");
  }
}
