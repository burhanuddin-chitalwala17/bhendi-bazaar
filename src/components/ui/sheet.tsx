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

// From md a bottom sheet stretches across a wide screen; a right-hand panel keeps it
// narrow. The `-0` resets stop the phone's vertical slide combining into a diagonal one.
const SIDE_ON_DESKTOP =
  "md:inset-y-0 md:right-0 md:left-auto md:h-full md:max-h-none md:w-full md:max-w-sm md:rounded-none md:rounded-l-2xl md:border-t-0 md:border-l md:pb-4 md:data-[state=open]:slide-in-from-bottom-0 md:data-[state=closed]:slide-out-to-bottom-0 md:data-[state=open]:slide-in-from-right md:data-[state=closed]:slide-out-to-right";

function SheetContent({
  className,
  children,
  side = "bottom",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  /** `adaptive`: a bottom sheet on a phone, a right-hand panel from `md`. */
  side?: "bottom" | "adaptive";
}) {
  return (
    <DialogPrimitive.Portal data-slot="sheet-portal">
      <DialogPrimitive.Overlay
        data-slot="sheet-overlay"
        className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-scrim/50"
      />
      <DialogPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "bg-background fixed inset-x-0 bottom-0 z-50 flex max-h-overlay flex-col gap-3 overflow-y-auto rounded-t-2xl border-t p-4 shadow-overlay outline-none duration-200",
          "pb-[calc(1rem+env(safe-area-inset-bottom))]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
          side === "adaptive" && SIDE_ON_DESKTOP,
          className,
        )}
        {...props}
      >
        {/* Grab handle: the affordance that says "swipe or tap away", not "read me". */}
        <div
          aria-hidden
          className={cn(
            "mx-auto h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30",
            side === "adaptive" && "md:hidden",
          )}
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

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
};
