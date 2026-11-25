"use client";

import { Fragment, type ReactElement, type ReactNode } from "react";
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
import { SELECTION_BAR_COPY } from "./shared-copy";

export interface SelectionAction {
  label: string;
  onClick: () => void;
  /** This action's work is in flight: the button shows it and ignores a second tap. */
  pending?: boolean;
  /** Wraps the button, so it can be an overlay's trigger (a picker anchors to it). */
  wrap?: (button: ReactElement) => ReactNode;
}

/** Long work the selection started: its progress replaces the actions, which wait, until it ends or is cancelled. */
export interface SelectionBusy {
  label: string;
  done: number;
  total: number;
  cancel: { label: string; onClick: () => void };
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
  /**
   * Widen the selection past the page (design-system Q35): offered once every visible row is
   * picked, as Gmail and Shopify do. The screen says what "all" is: "Select all 105".
   */
  selectAll?: { label: string; onClick: () => void };
  /** Said with nothing picked yet; with it the bar stays, so a screen's selection mode shows it is on. */
  hint?: string;
  busy?: SelectionBusy;
}

/** What to do with the rows a viewer picked. Absent until something is picked. */
export function SelectionBar({
  count,
  actions,
  onClear,
  noun = "selected",
  dock,
  selectAll,
  hint,
  busy,
}: SelectionBarProps) {
  if (count <= 0 && !hint && !busy) return null;
  const shown = actions.slice(0, VISIBLE_ACTIONS);
  const more = actions.slice(VISIBLE_ACTIONS);

  return (
    <div
      role="region"
      aria-label={SELECTION_BAR_COPY.selection}
      className={cn(selectionBarVariants({ dock }))}
    >
      <div className="mb-2 flex items-center gap-2 rounded-card bg-foreground py-2 pl-4 pr-2 text-background shadow-overlay md:mb-0 md:min-w-96">
        <div className="min-w-0 flex-1">
          <p aria-live="polite" className="truncate text-small font-semibold tabular-nums">
            {busy ? busy.label : count > 0 ? `${count} ${noun}` : hint}
          </p>
          {busy && (
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={busy.total}
              aria-valuenow={busy.done}
              aria-label={busy.label}
              className="mt-1 h-1 overflow-hidden rounded-full bg-background/20"
            >
              <div
                className="h-full rounded-full bg-background transition-all duration-base ease-standard"
                style={{ width: `${busy.total > 0 ? (busy.done / busy.total) * 100 : 0}%` }}
              />
            </div>
          )}
        </div>
        {busy ? (
          <Button variant="inverse" size="sm" onClick={busy.cancel.onClick}>
            {busy.cancel.label}
          </Button>
        ) : (
          <>
            {selectAll && (
              <Button variant="inverse" size="sm" className="underline underline-offset-4" onClick={selectAll.onClick}>
                {selectAll.label}
              </Button>
            )}
            {shown.map((action) => {
              const button = (
                <Button key={action.label} variant="inverse" size="sm" pending={action.pending} onClick={action.onClick}>
                  {action.label}
                </Button>
              );
              return action.wrap ? <Fragment key={action.label}>{action.wrap(button)}</Fragment> : button;
            })}
            {more.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="inverse" size="sm" shape="icon" aria-label={SELECTION_BAR_COPY.moreActions}>
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
              aria-label={SELECTION_BAR_COPY.clearSelection}
              onClick={onClear}
            >
              <Icon name="close" size="md" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
