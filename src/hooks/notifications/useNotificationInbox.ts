"use client";

import { useCallback, useEffect, useState } from "react";
import { NOTIFICATION_VIEW } from "@server/notifications/in-app.types";
import type { ClientNotification, NotificationPage } from "./notification.types";

const POLL_MS = 30_000;

/** The unread notifications and their count, polled; marking one read removes it from here. */
export function useNotificationInbox() {
  const [notifications, setNotifications] = useState<ClientNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/notifications?view=${NOTIFICATION_VIEW.INBOX}`);
      if (!res.ok) return;
      const data: NotificationPage = await res.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // A missed poll is retried on the next tick; the badge is not worth an error.
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(refresh, POLL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const markRead = useCallback(async (body: { notificationId: string } | { markAll: true }) => {
    const res = await fetch("/api/notifications/read", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return false;
    const { unreadCount: remaining }: { unreadCount: number } = await res.json();
    setNotifications((prev) =>
      "markAll" in body ? [] : prev.filter((n) => n.id !== body.notificationId)
    );
    setUnreadCount(remaining);
    return true;
  }, []);

  return { notifications, unreadCount, markRead, refresh };
}
