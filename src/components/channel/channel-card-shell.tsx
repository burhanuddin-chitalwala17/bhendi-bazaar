import type { ReactNode } from "react";

import { StatusBadge } from "@/components/shared/badges/StatusBadge";

type ChipTone = "connected" | "attention" | "problem" | "muted";

interface ChannelCardShellProps {
  label: string;
  chip?: { tone: ChipTone; text: string };
  /** Shown in the chip's place, for a card whose action is the header (a feed toggle). */
  headerAction?: ReactNode;
  children?: ReactNode;
}

/** The frame every channel card shares: initial, name, state chip, then the card's own body. */
export function ChannelCardShell({ label, chip, headerAction, children }: ChannelCardShellProps) {
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-card border bg-card p-4 text-card-foreground">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-field bg-muted text-sm font-semibold text-muted-foreground"
          >
            {label.charAt(0)}
          </span>
          <h2 className="truncate text-base font-semibold">{label}</h2>
        </div>
        {chip ? <StatusBadge status={chip.tone}>{chip.text}</StatusBadge> : headerAction}
      </div>
      {children}
    </article>
  );
}
