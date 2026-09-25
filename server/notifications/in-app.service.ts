import { inAppNotificationRepository } from "./in-app.repository";
import type {
  CreateInAppNotificationInput,
  GetNotificationsQuery,
  InAppNotificationDTO,
  MarkReadInput,
} from "./in-app.types";

export const inAppNotificationService = {
  /**
   * Creates an in-app notification for a user.
   */
  async notifyUser(input: CreateInAppNotificationInput): Promise<InAppNotificationDTO> {
    if (!input.userId || !input.title || !input.message) {
      throw new Error("userId, title, and message are required for in-app notification");
    }
    return inAppNotificationRepository.create(input);
  },

  /**
   * Retrieves notifications and unread count for a user.
   */
  async getUserNotifications(query: GetNotificationsQuery): Promise<{
    notifications: InAppNotificationDTO[];
    unreadCount: number;
    nextCursor?: string;
  }> {
    if (!query.userId) {
      throw new Error("userId is required to fetch notifications");
    }

    const [result, unreadCount] = await Promise.all([
      inAppNotificationRepository.findByUserId(query),
      inAppNotificationRepository.countUnread(query.userId),
    ]);

    return {
      notifications: result.notifications,
      unreadCount,
      nextCursor: result.nextCursor,
    };
  },

  /**
   * Marks a notification or all notifications as read for a user.
   */
  async markAsRead(input: MarkReadInput): Promise<{ unreadCount: number }> {
    if (!input.userId) {
      throw new Error("userId is required to mark notifications as read");
    }

    await inAppNotificationRepository.markRead(input);
    const unreadCount = await inAppNotificationRepository.countUnread(input.userId);

    return { unreadCount };
  },
};
