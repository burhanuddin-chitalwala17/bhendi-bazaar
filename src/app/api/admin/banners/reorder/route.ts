/**
 * PATCH /api/admin/banners/reorder — the display order, as a complete list of ids.
 *
 * Its own route because it rewrites every row in one transaction; folding it into the
 * item PATCH would make the common edit carry that.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { bannerService } from "@server/catalog/banner.service";
import { reorderBannersSchema } from "@/lib/validation/schemas/banner.schema";

export async function PATCH(request: NextRequest) {
  try {
    const session = await requirePlatformAdmin();
    const { ids } = reorderBannersSchema.parse(await request.json());
    await bannerService.reorder(session.user.id, ids);
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error, "Could not reorder banners");
  }
}
