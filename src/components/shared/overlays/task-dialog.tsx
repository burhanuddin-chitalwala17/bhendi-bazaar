"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** How much room the content needs on a wide screen. A phone gets all of it either way. */
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
 * A task with a canvas: a centred dialog sized to its content on a wide screen, the whole phone
 * below the breakpoint ([ADR-0040](../../../../docs/adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md)
 * decision 2). A picture being cropped or compared needs room, which a side panel never had.
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
          // Base is the phone: the sheet's full-height panel, rounded only where it meets the top.
          "inset-0 top-0 left-0 max-h-none h-dvh w-full max-w-none translate-x-0 translate-y-0 rounded-none p-4",
          "pb-[calc(1rem+env(safe-area-inset-bottom))]",
          // From `md` it becomes what a laptop should have had all along.
          "md:inset-auto md:top-[50%] md:left-[50%] md:h-auto md:max-h-overlay md:w-full md:translate-x-[-50%] md:translate-y-[-50%] md:rounded-card md:p-6 md:pb-6",
          WIDTHS[width],
          className,
        )}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
