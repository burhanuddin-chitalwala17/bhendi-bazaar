// src/app/api/admin/shipping/providers/[id]/connect/route.ts

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";
import { adminConnectionService } from "@server/shipping/services/connection.service";
import { z } from "zod";
import { toErrorResponse } from "@/lib/api-error-response";

const connectSchema = z.object({
  type: z.enum(["email_password", "api_key", "oauth"]),
  email: z.string().email().optional(),
  password: z.string().min(1).optional(),
});

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
    const body = await request.json();
    const validated = connectSchema.parse(body);

    // Connect provider via service
    const result = await adminConnectionService.connect(
      id,
      validated,
      session.user.id
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error, "Could not connect provider");
  }
}