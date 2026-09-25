import { prisma } from "@server/shared/prisma";
import {
  NOTIFICATION_TYPE,
  NOTIFICATION_VIEW,
  type CreateInAppNotificationInput,
  GetNotificationsQuery,
  InAppNotificationDTO,
  MarkReadInput,
} from "./in-app.types";

export const inAppNotificationRepository = {
  /**
   * Creates a new in-app notification for a user.
   */
  async create(input: CreateInAppNotificationInput): Promise<InAppNotificationDTO> {
    return prisma.inAppNotification.create({
      data: {
        userId: input.userId,
        title: input.title,
        message: input.message,
        type: input.type ?? NOTIFICATION_TYPE.SYSTEM,
        link: input.link ?? null,
      },
    });
  },

  /**
   * Fetches paginated notifications for a specific user, ordered newest first.
   */
  async findByUserId(query: GetNotificationsQuery): Promise<{
    notifications: InAppNotificationDTO[];
    nextCursor?: string;
  }> {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 50);

    const history = query.view === NOTIFICATION_VIEW.HISTORY;

    const items = await prisma.inAppNotification.findMany({
      where: { userId: query.userId, isRead: history },
      take: limit + 1,
      ...(query.cursor
        ? {
            cursor: { id: query.cursor },
            skip: 1,
          }
        : {}),
      // History reads in the order things were dealt with; id breaks ties so the cursor is stable.
      orderBy: history
        ? [{ readAt: "desc" }, { id: "desc" }]
        : [{ createdAt: "desc" }, { id: "desc" }],
    });

    let nextCursor: string | undefined = undefined;
    if (items.length > limit) {
      const nextItem = items.pop();
      nextCursor = nextItem?.id;
    }

    return {
      notifications: items,
      nextCursor,
    };
  },

  /**
   * Gets the count of unread notifications for a user.
   */
  async countUnread(userId: string): Promise<number> {
    return prisma.inAppNotification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  },

  /**
   * Marks a specific notification or all notifications as read for a user.
   */
  async markRead(input: MarkReadInput): Promise<{ count: number }> {
    const now = new Date();

    if (input.markAll) {
      const result = await prisma.inAppNotification.updateMany({
        where: {
          userId: input.userId,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: now,
        },
      });
      return { count: result.count };
    }

    if (input.notificationId) {
      const result = await prisma.inAppNotification.updateMany({
        where: {
          id: input.notificationId,
          userId: input.userId,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: now,
        },
      });
      return { count: result.count };
    }

    return { count: 0 };
  },
};
