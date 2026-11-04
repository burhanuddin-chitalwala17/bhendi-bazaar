import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { StateActionButton, type StateAction } from "./state-action";

const emptyStateVariants = cva("flex flex-col gap-3 py-10", {
  variants: {
    align: {
      start: "items-start text-left",
      center: "items-center text-center",
    },
  },
  defaultVariants: { align: "start" },
});

// The arch is decoration; gold is the brand's warmer voice for a first-run empty.
const MARK_TONE = { muted: "text-muted-foreground", gold: "text-accent" } as const;

export interface EmptyStateProps extends VariantProps<typeof emptyStateVariants> {
  title: string;
  description: ReactNode;
  /** One way forward. An href works from a server page; onClick needs a client parent. */
  action?: StateAction;
  tone?: keyof typeof MARK_TONE;
  as?: "h2" | "h3";
  className?: string;
}

/** Nothing here yet: the brand arch, what this place is for, and one thing to do about it. */
export function EmptyState({ title, description, action, align, tone = "muted", as: Heading = "h2", className }: EmptyStateProps) {
  return (
    <div className={cn(emptyStateVariants({ align }), className)}>
      <Icon name="arch" size="2xl" className={MARK_TONE[tone]} />
      <Heading className="text-title font-semibold text-foreground">{title}</Heading>
      <p className="max-w-md text-small text-muted-foreground">{description}</p>
      {action && <StateActionButton action={action} />}
    </div>
  );
}
