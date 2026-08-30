/**
 * GET  /api/admin/banners — every banner, active or not, in display order.
 * POST /api/admin/banners — create one; it appends to the end.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { toErrorResponse } from "@/lib/api-error-response";
import { bannerService } from "@server/catalog/banner.service";
import { bannerFormSchema } from "@/lib/validation/schemas/banner.schema";

export async function GET() {
  try {
    await requirePlatformAdmin();
    return NextResponse.json({ banners: await bannerService.listAll() });
  } catch (error) {
    return toErrorResponse(error, "Could not fetch banners");
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePlatformAdmin();
    const body = bannerFormSchema.parse(await request.json());
    const banner = await bannerService.create(session.user.id, body);
    return NextResponse.json(banner, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Could not create banner");
  }
}
