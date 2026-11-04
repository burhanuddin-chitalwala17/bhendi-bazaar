"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { FORM_FACTOR_QUERY, useMediaQuery } from "@/hooks/core/useMediaQuery";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

/** What a hand-off becomes from `lg:`: a popover beside its control, or a 28rem side sheet. */
export const HANDOFF_WIDE = { POPOVER: "popover", SIDE: "side" } as const;
export type HandoffWide = (typeof HANDOFF_WIDE)[keyof typeof HANDOFF_WIDE];

interface HandoffSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The control that opens it; the popover anchors to it. */
  trigger: ReactNode;
  title: string;
  /** The close control's accessible name, from the caller's copy. */
  closeLabel: string;
  description?: string;
  wide: HandoffWide;
  children: ReactNode;
}

/**
 * A short flow the page hands off to and gets back from — a hint, share, a pickup address
 * ([ADR-0040](../../../../docs/adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md) case 4;
 * own-store onboarding D10). A bottom sheet below `lg:`, so the page underneath keeps its state.
 */
export function HandoffSheet({ open, onOpenChange, trigger, title, closeLabel, description, wide, children }: HandoffSheetProps) {
  const isDesktop = useMediaQuery(FORM_FACTOR_QUERY.desktop);

  if (isDesktop && wide === HANDOFF_WIDE.POPOVER) {
    return (
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent side="right" className="w-80 space-y-3" aria-label={title}>
          <p className="font-heading text-base font-semibold">{title}</p>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
          {children}
        </PopoverContent>
      </Popover>
    );
  }

  const side = isDesktop && wide === HANDOFF_WIDE.SIDE;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side={side ? "adaptive" : "bottom"} className={cn(side && "md:max-w-md")}
        {...(description ? {} : { "aria-describedby": undefined })}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <SheetTitle>{title}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </div>
          <SheetClose asChild>
            <Button variant="ghost" shape="icon" className="size-11 shrink-0" aria-label={closeLabel}>
              <Icon name="close" size="sm" />
            </Button>
          </SheetClose>
        </div>
        {children}
      </SheetContent>
    </Sheet>
  );
}
