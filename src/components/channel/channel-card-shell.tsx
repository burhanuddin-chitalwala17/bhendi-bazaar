import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { StatusBadge, type StatusTone } from "@/components/shared/badges/StatusBadge";

type ChipTone = "connected" | "attention" | "problem" | "muted";
const CHIP_TONE: Record<ChipTone, StatusTone> = { connected: "success", attention: "warning", problem: "destructive", muted: "neutral" };

const shellVariants = cva("flex h-full min-w-0 flex-col gap-4 rounded-card border p-4 text-card-foreground md:p-5", {
  variants: {
    // `soon` is a channel being built: present, quieter, nothing to press.
    tone: { live: "bg-card", soon: "border-dashed bg-muted/40" },
  },
  defaultVariants: { tone: "live" },
});

interface ChannelCardShellProps extends VariantProps<typeof shellVariants> {
  label: string;
  /** The platform's own mark, or our logo for the store. */
  mark: ReactNode;
  /** What the channel does, one line under its name. */
  purpose: string;
  chip?: { tone: ChipTone; text: string };
  /** The card's actions, right-aligned under a rule; a card with nothing to do has none. */
  actions?: ReactNode;
  children?: ReactNode;
}

/** The frame every channel card shares: mark, name and purpose, state chip, detail, then actions. */
export function ChannelCardShell({ label, mark, purpose, chip, actions, tone, children }: ChannelCardShellProps) {
  return (
    <article className={shellVariants({ tone })}>
      <div className="flex items-start gap-3">
        {mark}
        <div className="min-w-0 flex-1">
          <h3 className="text-body font-semibold text-foreground">{label}</h3>
          <p className="text-small text-muted-foreground">{purpose}</p>
        </div>
        {chip && <StatusBadge tone={CHIP_TONE[chip.tone]} className="shrink-0">{chip.text}</StatusBadge>}
      </div>
      {children && <div className="flex flex-col gap-1 text-small text-muted-foreground">{children}</div>}
      {actions && (
        <div className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">{actions}</div>
      )}
    </article>
  );
}
