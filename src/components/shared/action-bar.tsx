import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * A page's primary actions, docked where a thumb reaches them on a phone and inline from a
 * tablet up. One per page; it replaces the hand-rolled sticky save bars.
 */
const actionBarVariants = cva(
  "sticky z-20 border-t border-border bg-background/95 backdrop-blur md:static md:z-auto md:border-0 md:bg-transparent md:backdrop-blur-none",
  {
    variants: {
      // Above the tab bar where the layout has one, else on the screen's edge clear of the home indicator.
      dock: {
        tabbar: "bottom-tabbar",
        edge: "bottom-0 pb-safe md:pb-0",
      },
    },
    defaultVariants: { dock: "tabbar" },
  },
);

export interface ActionBarProps extends VariantProps<typeof actionBarVariants> {
  /** The actions, primary last so it sits under the thumb. */
  children: ReactNode;
  /** What the actions act on: "2 unsaved changes". */
  status?: ReactNode;
  /** Layout only: a negative margin to bleed to the page gutter, say. */
  className?: string;
}

export function ActionBar({ dock, status, children, className }: ActionBarProps) {
  return (
    <div data-slot="action-bar" className={cn(actionBarVariants({ dock }), className)}>
      <div className="flex items-center gap-3 px-4 py-3 md:justify-end md:px-0 md:py-0">
        {status && <div className="min-w-0 flex-1 text-caption text-muted-foreground">{status}</div>}
        <div className={cn("flex items-center gap-2", !status && "flex-1 justify-end md:flex-none")}>{children}</div>
      </div>
    </div>
  );
}
