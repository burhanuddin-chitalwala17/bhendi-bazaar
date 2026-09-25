"use client";

import { useCallback, useEffect, useState } from "react";
import { NOTIFICATION_VIEW } from "@server/notifications/in-app.types";
import type { ClientNotification, NotificationPage } from "./notification.types";

/**
 * The notifications already marked read, most recently read first, a page at a time.
 * Fetched only while `active`, and afresh each time it becomes active, so anything
 * read in the inbox since is already here.
 */
export function useNotificationHistory(active: boolean) {
  const [notifications, setNotifications] = useState<ClientNotification[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (cursor?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ view: NOTIFICATION_VIEW.HISTORY });
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(`/api/notifications?${params}`);
      if (!res.ok) return;
      const data: NotificationPage = await res.json();
      setNotifications((prev) => (cursor ? [...prev, ...data.notifications] : data.notifications));
      setNextCursor(data.nextCursor);
    } catch {
      // Leaves the list as it was; the user can reopen history to retry.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active) void load();
  }, [active, load]);

  const loadMore = useCallback(() => {
    if (nextCursor) void load(nextCursor);
  }, [load, nextCursor]);

  return { notifications, hasMore: Boolean(nextCursor), loading, loadMore };
}
