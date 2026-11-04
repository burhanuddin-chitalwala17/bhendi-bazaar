import type { ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * The one status chip. A state is one word and one tone, so "Live" reads the same on every
 * screen and a palette change is a token edit, not a hunt through hand-rolled chips.
 */
const statusBadgeVariants = cva(
  "inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-field px-2 text-caption font-semibold",
  {
    variants: {
      tone: {
        success: "bg-success/15 text-success",
        warning: "bg-warning/15 text-warning",
        info: "bg-info/15 text-info",
        neutral: "bg-muted text-muted-foreground",
        destructive: "bg-destructive/15 text-destructive",
        deal: "bg-deal text-deal-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type StatusTone = NonNullable<VariantProps<typeof statusBadgeVariants>["tone"]>;

export interface StatusBadgeProps extends VariantProps<typeof statusBadgeVariants> {
  children: ReactNode;
  /** A lifecycle state (an order moving) carries a dot; a fact (a discount) does not. */
  dot?: boolean;
  className?: string;
}

export function StatusBadge({ tone, dot, children, className }: StatusBadgeProps) {
  return (
    <span data-tone={tone ?? "neutral"} className={cn(statusBadgeVariants({ tone }), className)}>
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

// Success, not deal: PriceDisplay renders outside a theme scope, where `--deal` is unset.
export function OfferBadge({ percentOff }: { percentOff?: number }) {
  return <StatusBadge tone="success">{percentOff && percentOff >= 1 ? `${percentOff}% off` : "Offer"}</StatusBadge>;
}

export function StockBadge({ stock, threshold = 10 }: { stock: number; threshold?: number }) {
  if (stock === 0) return <StatusBadge tone="neutral">Sold out</StatusBadge>;
  if (stock <= threshold) return <StatusBadge tone="warning">Low stock · {stock}</StatusBadge>;
  return <StatusBadge tone="success">In stock</StatusBadge>;
}
