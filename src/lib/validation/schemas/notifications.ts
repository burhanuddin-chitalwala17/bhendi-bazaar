import { z } from "zod";
import { NOTIFICATION_TYPE, NOTIFICATION_VIEW } from "@server/notifications/in-app.types";
import { safeTextSchema } from "./common.schemas";

export const getNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).default(20),
  cursor: z.string().optional(),
  view: z.enum(NOTIFICATION_VIEW).default(NOTIFICATION_VIEW.INBOX),
});

export const markNotificationReadSchema = z.object({
  notificationId: z.string().optional(),
  markAll: z.boolean().optional(),
});

export const createInAppNotificationSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  title: safeTextSchema,
  message: safeTextSchema,
  type: z.enum(NOTIFICATION_TYPE).default(NOTIFICATION_TYPE.SYSTEM),
  link: z.string().max(2048).optional(),
});
