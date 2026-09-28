"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** How much room the content needs on a wide screen. A phone gets the whole screen either way. */
const WIDTHS = {
  /** A crop frame, a before-and-after: one large picture and its controls. */
  canvas: "md:max-w-3xl",
  /** A grid of pictures to choose from. */
  gallery: "md:max-w-4xl",
} as const;

export type TaskDialogWidth = keyof typeof WIDTHS;

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  width?: TaskDialogWidth;
  children: React.ReactNode;
  className?: string;
}

/**
 * A task with a canvas: a centred panel with room for a picture on a wide screen, the whole phone
 * below the breakpoint ([ADR-0040](../../../../docs/adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md)
 * decision 2).
 *
 * The panel never scrolls. Its height is settled before the content is laid out, and the body is a
 * column the content flexes inside — a canvas takes the room that is left, controls keep theirs.
 * A scrollbar around a crop frame means the frame is bigger than the screen, which is the one
 * thing a crop frame must not be. On a wide screen it stops short of the edges; a phone has no
 * room to spare and gets the whole of it.
 */
export function TaskDialog({
  open,
  onOpenChange,
  title,
  description,
  width = "canvas",
  children,
  className,
}: TaskDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col gap-3 overflow-hidden",
          // Base is the phone: the whole screen, square corners, safe area at the foot.
          "inset-0 top-0 left-0 h-dvh max-h-none w-full max-w-none translate-x-0 translate-y-0 rounded-none p-4",
          "pb-[calc(1rem+env(safe-area-inset-bottom))]",
          // From `md`, a centred panel tall enough for a picture and short enough to fit.
          "md:inset-auto md:top-[50%] md:left-[50%] md:h-[min(82dvh,46rem)] md:w-full md:translate-x-[-50%] md:translate-y-[-50%] md:rounded-card md:p-6 md:pb-6",
          WIDTHS[width],
          className,
        )}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
