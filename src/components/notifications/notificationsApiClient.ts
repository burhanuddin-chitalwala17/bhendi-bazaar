import { apiRequest } from "@/lib/api-client";
import type { NotificationPrefsInput } from "@/lib/validation/schemas/notifications.schema";
import type { NeedsYouDTO, NotificationPrefsDTO } from "@server/notifications/notification.types";

/** The bell and the member's notification switches (notifications-core D3, D4). */
export const notificationsApiClient = {
  needsYou: (orgId: string, signal?: AbortSignal) => apiRequest<NeedsYouDTO>(`/api/org/${orgId}/notifications`, { signal }),

  savePrefs: (orgId: string, data: NotificationPrefsInput) =>
    apiRequest<NotificationPrefsDTO>(`/api/org/${orgId}/notifications/prefs`, { method: "PUT", body: data }),
};
