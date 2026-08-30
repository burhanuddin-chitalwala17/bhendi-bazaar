/**
 * PATCH /api/admin/banners/[id]/active — publish or take down one banner.
 *
 * Its own route so a toggle carries only what it changes. Routing it through the
 * content PATCH would make the list rebuild a whole banner from what it happens to be
 * holding, and that PATCH replaces the action rows wholesale — so flipping a switch
 * would rewrite copy and re-mint button ids as a side effect.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { bannerService } from "@server/catalog/banner.service";
import { setBannerActiveSchema } from "@/lib/validation/schemas/banner.schema";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePlatformAdmin();
    const { id } = await params;
    const { isActive } = setBannerActiveSchema.parse(await request.json());
    return NextResponse.json(
      await bannerService.setActive(session.user.id, id, isActive)
    );
  } catch (error) {
    return toErrorResponse(error, "Could not update banner");
  }
}
