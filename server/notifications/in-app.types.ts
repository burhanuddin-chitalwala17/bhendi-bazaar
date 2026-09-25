import type { NotificationType as DbNotificationType } from "@prisma/client";

// The `satisfies` fails to compile if this drifts from the schema enum in either direction.
export const NOTIFICATION_TYPE = {
  ORDER_UPDATE: "ORDER_UPDATE",
  BID_OUTBID: "BID_OUTBID",
  PROMOTION: "PROMOTION",
  SYSTEM: "SYSTEM",
} as const satisfies { [K in DbNotificationType]: K };

export type NotificationType = (typeof NOTIFICATION_TYPE)[keyof typeof NOTIFICATION_TYPE];

/** Which half of a user's notifications a list shows: still unread, or already read. */
export const NOTIFICATION_VIEW = {
  INBOX: "inbox",
  HISTORY: "history",
} as const;

export type NotificationView = (typeof NOTIFICATION_VIEW)[keyof typeof NOTIFICATION_VIEW];

export interface InAppNotificationDTO {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  link?: string | null;
  isRead: boolean;
  readAt?: Date | null;
  createdAt: Date;
}

export interface CreateInAppNotificationInput {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  link?: string;
}

export interface GetNotificationsQuery {
  userId: string;
  limit?: number;
  cursor?: string;
  view?: NotificationView;
}

export interface MarkReadInput {
  userId: string;
  notificationId?: string;
  markAll?: boolean;
}
