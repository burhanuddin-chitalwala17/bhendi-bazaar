export type NotificationType = "ORDER_UPDATE" | "BID_OUTBID" | "PROMOTION" | "SYSTEM";

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
  onlyUnread?: boolean;
}

export interface MarkReadInput {
  userId: string;
  notificationId?: string;
  markAll?: boolean;
}
