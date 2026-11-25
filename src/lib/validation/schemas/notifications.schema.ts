import { z } from "zod";

/** A member's notification switches for one shop (notifications-core D4). The badge and at-once alerts have none. */
export const notificationPrefsSchema = z.object({ morningEmail: z.boolean() }).strict();
export type NotificationPrefsInput = z.infer<typeof notificationPrefsSchema>;
