import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { inAppNotificationService } from "@server/notifications/in-app.service";
import { validateRequest } from "@/lib/validation";
import { markNotificationReadSchema } from "@/lib/validation/schemas/notifications";
import { toErrorResponse } from "@/lib/api-error-response";

/**
 * PATCH /api/notifications/read
 * Marks a single notification or all notifications as read for the authenticated user.
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Sign in to manage notifications" },
        { status: 401 }
      );
    }

    const validation = await validateRequest(request, markNotificationReadSchema);
    if ("error" in validation) return validation.error;

    const result = await inAppNotificationService.markAsRead({
      userId: session.user.id,
      notificationId: validation.data.notificationId,
      markAll: validation.data.markAll,
    });

    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (error) {
    return toErrorResponse(error, "Could not mark notifications as read");
  }
}

export async function POST(request: NextRequest) {
  return PATCH(request);
}
