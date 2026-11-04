"use client";

import { cva, type VariantProps } from "class-variance-authority";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export interface SelectionAction {
  label: string;
  onClick: () => void;
  /** This action's work is in flight: the button shows it and ignores a second tap. */
  pending?: boolean;
}

/** More than this and the bar stops fitting a phone; the rest go behind "More". */
const VISIBLE_ACTIONS = 3;

const selectionBarVariants = cva(
  "fixed inset-x-3 z-30 md:inset-x-auto md:bottom-6 md:left-1/2 md:pb-0 md:-translate-x-1/2",
  {
    variants: {
      // Above the tab bar on a phone where there is one; floating and centred from md either way.
      dock: {
        tabbar: "bottom-tabbar",
        edge: "bottom-0 pb-safe",
      },
    },
    defaultVariants: { dock: "tabbar" },
  },
);

export interface SelectionBarProps extends VariantProps<
  typeof selectionBarVariants
> {
  count: number;
  actions: readonly SelectionAction[];
  onClear: () => void;
  /** "selected" by default; a screen may name the thing: "products selected". */
  noun?: string;
}

/** What to do with the rows a viewer picked. Absent until something is picked. */
export function SelectionBar({
  count,
  actions,
  onClear,
  noun = "selected",
  dock,
}: SelectionBarProps) {
  if (count <= 0) return null;
  const shown = actions.slice(0, VISIBLE_ACTIONS);
  const more = actions.slice(VISIBLE_ACTIONS);

  return (
    <div
      role="region"
      aria-label="Selection"
      className={cn(selectionBarVariants({ dock }))}
    >
      <div className="mb-2 flex items-center gap-2 rounded-card bg-foreground py-2 pl-4 pr-2 text-background shadow-overlay md:mb-0 md:min-w-96">
        <p
          aria-live="polite"
          className="min-w-0 flex-1 truncate text-small font-semibold tabular-nums"
        >
          {count} {noun}
        </p>
        {shown.map((action) => (
          <Button
            key={action.label}
            variant="inverse"
            size="sm"
            pending={action.pending}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        ))}
        {more.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="inverse"
                size="sm"
                shape="icon"
                aria-label="More actions"
              >
                <Icon name="more" size="md" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {more.map((action) => (
                <DropdownMenuItem key={action.label} onSelect={action.onClick}>
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button
          variant="inverse"
          size="sm"
          shape="icon"
          aria-label="Clear selection"
          onClick={onClear}
        >
          <Icon name="close" size="md" />
        </Button>
      </div>
    </div>
  );
}
