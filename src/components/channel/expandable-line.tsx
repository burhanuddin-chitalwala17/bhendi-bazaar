"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** One line that truncates, and shows in full on a tap (ux.md "Long content"). */
export function ExpandableLine({ children, className }: { children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Button
      variant="ghost"
      aria-expanded={open}
      onClick={() => setOpen((value) => !value)}
      className={cn("h-auto min-h-10 w-full justify-start whitespace-normal p-0 text-left font-normal hover:bg-transparent", className)}
    >
      <span className={cn("min-w-0", open ? "break-words" : "truncate")}>{children}</span>
    </Button>
  );
}
