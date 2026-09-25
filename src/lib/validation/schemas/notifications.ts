import { z } from "zod";
import { safeTextSchema } from "./common.schemas";

export const getNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).default(20),
  cursor: z.string().optional(),
  onlyUnread: z.preprocess((v) => v === "true" || v === true, z.boolean()).optional(),
});

export const markNotificationReadSchema = z.object({
  notificationId: z.string().optional(),
  markAll: z.boolean().optional(),
});

export const createInAppNotificationSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  title: safeTextSchema,
  message: safeTextSchema,
  type: z.enum(["ORDER_UPDATE", "BID_OUTBID", "PROMOTION", "SYSTEM"]).default("SYSTEM"),
  link: z.string().max(2048).optional(),
});
