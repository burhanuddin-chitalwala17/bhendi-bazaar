import { Gavel, Info, Package, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { NOTIFICATION_TYPE, type NotificationType } from "@server/notifications/in-app.types";

const TYPE_META: Record<NotificationType, { label: string; icon: typeof Info; tone: string }> = {
  [NOTIFICATION_TYPE.ORDER_UPDATE]: { label: "Order update", icon: Package, tone: "text-info" },
  [NOTIFICATION_TYPE.BID_OUTBID]: { label: "Outbid", icon: Gavel, tone: "text-warning" },
  [NOTIFICATION_TYPE.BID_OFFER]: { label: "You won", icon: Gavel, tone: "text-success" },
  [NOTIFICATION_TYPE.PROMOTION]: { label: "Offer", icon: Tag, tone: "text-success" },
  [NOTIFICATION_TYPE.SYSTEM]: { label: "Announcement", icon: Info, tone: "text-muted-foreground" },
};

export function notificationTypeLabel(type: NotificationType): string {
  return TYPE_META[type].label;
}

export function NotificationTypeIcon({ type, className }: { type: NotificationType; className?: string }) {
  const { icon: Icon, tone } = TYPE_META[type];
  return <Icon aria-hidden className={cn("size-4", tone, className)} />;
}

export function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Only a same-site path is followed: a notification's link must never leave the store. */
export function internalLink(link: string | null | undefined): string | null {
  return link && link.startsWith("/") && !link.startsWith("//") ? link : null;
}
