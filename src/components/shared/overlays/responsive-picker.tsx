"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useIsDesktop } from "@/hooks/core/useMediaQuery";
import { cn } from "@/lib/utils";

interface ResponsivePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The control the picker belongs to — the popover anchors to it, the sheet is opened by it. */
  trigger: React.ReactNode;
  /** Named for a screen reader on both surfaces; shown as a heading only in the sheet. */
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Widths the popover may take; the sheet ignores it and fills the phone. */
  className?: string;
}

/**
 * Choosing one value from a set: a popover against the field on a wide screen, a bottom sheet on a
 * phone ([ADR-0040](../../../../docs/adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md)
 * decision 1). The field stays the subject either way, which a side panel could not manage.
 */
export function ResponsivePicker({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  className,
}: ResponsivePickerProps) {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          className={cn("space-y-3", className)}
          aria-label={title}
        >
          {children}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent>
        <SheetTitle>{title}</SheetTitle>
        {description && <SheetDescription>{description}</SheetDescription>}
        {children}
      </SheetContent>
    </Sheet>
  );
}
