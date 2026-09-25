"use client";

import { useState } from "react";
import { Bell, CheckCheck, History, Inbox } from "lucide-react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NOTIFICATION_VIEW, type NotificationView } from "@server/notifications/in-app.types";
import { useNotificationInbox } from "@/hooks/notifications/useNotificationInbox";
import { useNotificationHistory } from "@/hooks/notifications/useNotificationHistory";
import type { ClientNotification } from "@/hooks/notifications/notification.types";
import { NotificationItem } from "./NotificationItem";
import { NotificationDialog } from "./NotificationDialog";

const EMPTY_STATE: Record<NotificationView, { title: string; body: string }> = {
  [NOTIFICATION_VIEW.INBOX]: {
    title: "You're all caught up",
    body: "We'll notify you when activity happens in your account.",
  },
  [NOTIFICATION_VIEW.HISTORY]: {
    title: "No read notifications yet",
    body: "Anything you mark as read is kept here.",
  },
};

export function NotificationBell({ className }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<NotificationView>(NOTIFICATION_VIEW.INBOX);
  const [selected, setSelected] = useState<ClientNotification | null>(null);

  const inbox = useNotificationInbox();
  const history = useNotificationHistory(open && view === NOTIFICATION_VIEW.HISTORY);
  const list = view === NOTIFICATION_VIEW.INBOX ? inbox.notifications : history.notifications;
  const { unreadCount } = inbox;

  // Reading a notification in full is reading it: it moves to history.
  const handleView = (n: ClientNotification) => {
    setSelected(n);
    if (!n.isRead) void inbox.markRead({ notificationId: n.id });
  };

  const handleOpenLink = (href: string) => {
    setSelected(null);
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("relative rounded-full", className)}
            aria-label={`Notifications (${unreadCount} unread)`}
          >
            <Bell className="size-5 text-foreground/80" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-3xs font-bold text-destructive-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Button>
        </SheetTrigger>

        <SheetContent side="adaptive" className="w-full max-w-md p-4">
          <div className="flex items-center justify-between gap-2 border-b pb-3">
            <div>
              <SheetTitle>Notifications</SheetTitle>
              <SheetDescription>
                {unreadCount > 0
                  ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
                  : "You're all caught up"}
              </SheetDescription>
            </div>
            {view === NOTIFICATION_VIEW.INBOX && unreadCount > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void inbox.markRead({ markAll: true })}
                className="gap-1 rounded-full text-xs"
              >
                <CheckCheck className="size-3.5" />
                Mark all read
              </Button>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2" aria-label="Notification views">
            <Button
              type="button"
              variant={view === NOTIFICATION_VIEW.INBOX ? "secondary" : "ghost"}
              aria-pressed={view === NOTIFICATION_VIEW.INBOX}
              onClick={() => setView(NOTIFICATION_VIEW.INBOX)}
              className="h-10"
            >
              <Inbox />
              Inbox
            </Button>
            <Button
              type="button"
              variant={view === NOTIFICATION_VIEW.HISTORY ? "secondary" : "ghost"}
              aria-pressed={view === NOTIFICATION_VIEW.HISTORY}
              onClick={() => setView(NOTIFICATION_VIEW.HISTORY)}
              className="h-10"
            >
              <History />
              History
            </Button>
          </div>

          <div className="mt-2 max-h-[70vh] flex-1 overflow-y-auto">
            {list.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Bell className="mb-2 size-10 stroke-1 text-muted-foreground/40" />
                <p className="text-sm font-medium">
                  {view === NOTIFICATION_VIEW.HISTORY && history.loading ? "Loading…" : EMPTY_STATE[view].title}
                </p>
                <p className="text-xs">{EMPTY_STATE[view].body}</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {list.map((n) => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onView={handleView}
                    onMarkRead={
                      view === NOTIFICATION_VIEW.INBOX
                        ? (item) => void inbox.markRead({ notificationId: item.id })
                        : undefined
                    }
                  />
                ))}
              </ul>
            )}

            {view === NOTIFICATION_VIEW.HISTORY && history.hasMore && (
              <Button
                type="button"
                variant="outline"
                onClick={history.loadMore}
                disabled={history.loading}
                className="mt-3 h-10 w-full"
              >
                {history.loading ? "Loading…" : "Load more"}
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <NotificationDialog
        notification={selected}
        onClose={() => setSelected(null)}
        onOpenLink={handleOpenLink}
      />
    </>
  );
}
