// src/app/api/admin/shipping/providers/[id]/disconnect/route.ts

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { adminConnectionService } from "@server/shipping/services/connection.service";
import { toErrorResponse } from "@/lib/api-error-response";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin access
    const session = await requirePlatformAdmin();

    const { id } = await params;

    // Disconnect provider via service
    const result = await adminConnectionService.disconnect(id, session.user.id);

    return NextResponse.json({
      success: true,
      message: `disconnected successfully`,
    });
  } catch (error) {
    return toErrorResponse(error, "Could not disconnect provider");
  }
}