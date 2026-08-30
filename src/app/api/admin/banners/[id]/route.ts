/**
 * PATCH  /api/admin/banners/[id] — replace the banner's content.
 * DELETE /api/admin/banners/[id] — remove it and its actions.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { bannerService } from "@server/catalog/banner.service";
import { bannerFormSchema } from "@/lib/validation/schemas/banner.schema";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePlatformAdmin();
    const { id } = await params;
    const body = bannerFormSchema.parse(await request.json());
    return NextResponse.json(await bannerService.update(session.user.id, id, body));
  } catch (error) {
    return toErrorResponse(error, "Could not update banner");
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePlatformAdmin();
    const { id } = await params;
    await bannerService.delete(session.user.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error, "Could not delete banner");
  }
}
