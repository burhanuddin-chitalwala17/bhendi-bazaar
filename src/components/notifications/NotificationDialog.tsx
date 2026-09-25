import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ClientNotification } from "@/hooks/notifications/notification.types";
import { NotificationTypeIcon, internalLink, notificationTypeLabel } from "./notification-meta";

interface NotificationDialogProps {
  notification: ClientNotification | null;
  onClose: () => void;
  onOpenLink: (href: string) => void;
}

export function NotificationDialog({ notification: n, onClose, onOpenLink }: NotificationDialogProps) {
  const href = internalLink(n?.link);

  return (
    <Dialog open={n !== null} onOpenChange={(open) => !open && onClose()}>
      {n && (
        <DialogContent>
          <DialogHeader>
            <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground sm:justify-start">
              <NotificationTypeIcon type={n.type} />
              {notificationTypeLabel(n.type)} · {new Date(n.createdAt).toLocaleString()}
            </p>
            <DialogTitle>{n.title}</DialogTitle>
            <DialogDescription className="whitespace-pre-line break-words">
              {n.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Close
              </Button>
            </DialogClose>
            {href && (
              <Button type="button" onClick={() => onOpenLink(href)}>
                Open
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
