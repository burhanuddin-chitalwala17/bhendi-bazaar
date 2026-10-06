"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsTabletUp } from "@/hooks/core/useMediaQuery";
import { cn } from "@/lib/utils";

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * A short form — a few fields and a submit button — that needs the phone's own surface
 * ([ADR-0040](../../../../docs/adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md)):
 * a bottom sheet below `md` (reachable by thumb, scrollable when the keyboard opens), a
 * centred dialog from `md` (where the form is small enough to float).
 *
 * Same construction as `ResponsivePicker`: two primitives, one breakpoint, one component.
 * The sheet carries its own phone form; a centred `DialogContent` at 360px pushes its
 * submit button under the keyboard with no way to scroll it back.
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: FormDialogProps) {
  const isWide = useIsTabletUp();

  if (isWide) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn("sm:max-w-md", className)}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className={cn("max-h-overlay rounded-t-card pb-safe", className)}>
        <SheetTitle>{title}</SheetTitle>
        {description && <SheetDescription>{description}</SheetDescription>}
        {children}
      </SheetContent>
    </Sheet>
  );
}
