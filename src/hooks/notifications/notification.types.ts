import type { InAppNotificationDTO } from "@server/notifications/in-app.types";

/** An `InAppNotificationDTO` after JSON: its dates arrive as strings. */
export type ClientNotification = Omit<InAppNotificationDTO, "createdAt" | "readAt"> & {
  createdAt: string;
  readAt?: string | null;
};

export interface NotificationPage {
  notifications: ClientNotification[];
  unreadCount: number;
  nextCursor?: string;
}
