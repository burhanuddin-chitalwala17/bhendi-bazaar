// src/app/api/admin/shipping/providers/[id]/disconnect/route.ts

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";
import { adminConnectionService } from "@server/shipping/services/connection.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin access
    const session = await verifyAdminSession();
    if (session instanceof NextResponse) {
      return session;
    }

    const { id } = await params;

    // Disconnect provider via service
    const result = await adminConnectionService.disconnect(id, session.user.id);

    return NextResponse.json({
      success: true,
      message: `disconnected successfully`,
    });
  } catch (error) {
    console.error("Disconnect provider error:", error);

    if (error instanceof Error && error.message === "Provider not found") {
      return NextResponse.json(
        { success: false, error: "Provider not found" },
        { status: 404 }
      );
    }

    if (
      error instanceof Error &&
      error.message === "Provider is not connected"
    ) {
      return NextResponse.json(
        { success: false, error: "Provider is not connected" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to disconnect provider",
      },
      { status: 500 }
    );
  }
}