import { Check, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ClientNotification } from "@/hooks/notifications/notification.types";
import { NotificationTypeIcon, timeAgo } from "./notification-meta";

interface NotificationItemProps {
  notification: ClientNotification;
  onView: (notification: ClientNotification) => void;
  /** Present in the inbox only; history items are already read. */
  onMarkRead?: (notification: ClientNotification) => void;
}

export function NotificationItem({ notification: n, onView, onMarkRead }: NotificationItemProps) {
  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-card border p-3",
        n.isRead ? "border-border/40 bg-card" : "border-accent/60 bg-accent/30"
      )}
    >
      <span className="mt-0.5 shrink-0 rounded-field border border-border/50 bg-background p-2">
        <NotificationTypeIcon type={n.type} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <p className={cn("line-clamp-1 text-xs text-foreground", n.isRead ? "font-semibold" : "font-bold")}>
            {n.title}
          </p>
          <span className="shrink-0 text-3xs text-muted-foreground">
            {n.isRead && n.readAt ? `Read ${timeAgo(n.readAt)}` : timeAgo(n.createdAt)}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
      </div>

      <div className="flex shrink-0 items-center">
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          onClick={() => onView(n)}
          aria-label={`View notification: ${n.title}`}
        >
          <Eye />
        </Button>
        {onMarkRead && (
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            onClick={() => onMarkRead(n)}
            aria-label={`Mark as read: ${n.title}`}
          >
            <Check />
          </Button>
        )}
      </div>
    </li>
  );
}
