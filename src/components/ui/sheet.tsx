"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { cn } from "@/lib/utils";

// A bottom sheet is the phone's dialog: it rises from the thumb, it is dismissed by
// tapping away, and it never puts its content under the home indicator. Dialog is the
// wrong primitive on a 360px screen — centred, zoom-animated, and inset by 1rem a side.
// Same Radix root underneath, so focus trapping and Escape behave identically.

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;

function SheetContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal data-slot="sheet-portal">
      <DialogPrimitive.Overlay
        data-slot="sheet-overlay"
        className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-scrim/50"
      />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "bg-background fixed inset-x-0 bottom-0 z-50 flex max-h-overlay flex-col gap-3 overflow-y-auto rounded-t-2xl border-t p-4 shadow-overlay outline-none duration-200",
          "pb-[calc(1rem+env(safe-area-inset-bottom))]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
          className
        )}
        {...props}
      >
        {/* Grab handle: the affordance that says "swipe or tap away", not "read me". */}
        <div
          aria-hidden
          className="mx-auto h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30"
        />
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-base font-semibold leading-none", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-xs", className)}
      {...props}
    />
  );
}

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger };
