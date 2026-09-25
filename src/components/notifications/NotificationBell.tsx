"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, Check, Package, Gavel, Tag, Info, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NOTIFICATION_TYPE, type NotificationType } from "@server/notifications/in-app.types";

interface InAppNotificationDTO {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  link?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

function getTypeIcon(type: InAppNotificationDTO["type"]) {
  switch (type) {
    case NOTIFICATION_TYPE.ORDER_UPDATE:
      return <Package className="h-4 w-4 text-blue-500" />;
    case NOTIFICATION_TYPE.BID_OUTBID:
      return <Gavel className="h-4 w-4 text-amber-500" />;
    case NOTIFICATION_TYPE.PROMOTION:
      return <Tag className="h-4 w-4 text-emerald-500" />;
    case NOTIFICATION_TYPE.SYSTEM:
    default:
      return <Info className="h-4 w-4 text-foreground/70" />;
  }
}

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell({ className }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<InAppNotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // Ignore network errors silently
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    // Poll every 30 seconds for unread updates
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleMarkAsRead = async (notificationId?: string, markAll = false) => {
    try {
      const res = await fetch("/api/notifications/read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId, markAll }),
      });

      if (res.ok) {
        if (markAll) {
          setNotifications((prev) =>
            prev.map((n) => ({ ...n, isRead: true }))
          );
          setUnreadCount(0);
        } else if (notificationId) {
          setNotifications((prev) =>
            prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n))
          );
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      }
    } catch {
      // Ignore network errors
    }
  };

  const handleNotificationClick = async (n: InAppNotificationDTO) => {
    if (!n.isRead) {
      await handleMarkAsRead(n.id);
    }
    setOpen(false);
    if (n.link) {
      router.push(n.link);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("relative rounded-full", className)}
          aria-label={`Notifications (${unreadCount} unread)`}
        >
          <Bell className="h-5 w-5 text-foreground/80" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground animate-in zoom-in">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="adaptive" className="w-full max-w-md p-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <SheetTitle>Notifications</SheetTitle>
            <SheetDescription>
              {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}` : "You're all caught up"}
            </SheetDescription>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleMarkAsRead(undefined, true)}
              className="text-xs h-8 gap-1 rounded-full"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </div>

        <div className="mt-2 flex-1 overflow-y-auto space-y-2 max-h-[70vh]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Bell className="h-10 w-10 stroke-1 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium">No notifications yet</p>
              <p className="text-xs text-muted-foreground">We&apos;ll notify you when activity happens in your account.</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={cn(
                  "group relative flex items-start gap-3 rounded-xl p-3 text-left transition-colors cursor-pointer border border-border/40 hover:bg-muted/60",
                  !n.isRead ? "bg-accent/30 border-accent/60" : "bg-card"
                )}
              >
                <div className="shrink-0 mt-0.5 rounded-lg bg-background p-2 border border-border/50">
                  {getTypeIcon(n.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className={cn("text-xs font-semibold text-foreground line-clamp-1", !n.isRead && "font-bold")}>
                      {n.title}
                    </p>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {n.message}
                  </p>
                </div>

                {!n.isRead && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkAsRead(n.id);
                    }}
                    title="Mark as read"
                    className="shrink-0 text-muted-foreground/60 hover:text-foreground p-1"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
