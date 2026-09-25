import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-config";
import { inAppNotificationService } from "@server/notifications/in-app.service";
import { validateQueryParams, validateRequest } from "@/lib/validation";
import { getNotificationsQuerySchema, createInAppNotificationSchema } from "@/lib/validation/schemas/notifications";
import { toErrorResponse } from "@/lib/api-error-response";

/**
 * GET /api/notifications
 * Returns user's in-app notifications and unread count.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Sign in to view notifications" },
        { status: 401 }
      );
    }

    const validation = validateQueryParams(
      request.nextUrl.searchParams,
      getNotificationsQuerySchema
    );
    if ("error" in validation) return validation.error;

    const data = await inAppNotificationService.getUserNotifications({
      userId: session.user.id,
      limit: validation.data.limit,
      cursor: validation.data.cursor,
      onlyUnread: validation.data.onlyUnread,
    });

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return toErrorResponse(error, "Could not fetch notifications");
  }
}

/**
 * POST /api/notifications
 * Route to send an in-app notification to a user.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const validation = await validateRequest(request, createInAppNotificationSchema);
    if ("error" in validation) return validation.error;

    const notification = await inAppNotificationService.notifyUser(validation.data);

    return NextResponse.json({ success: true, notification }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Could not create notification");
  }
}
