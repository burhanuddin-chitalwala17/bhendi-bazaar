// components/shared/badges/StatusBadge.tsx

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const statusBadgeVariants = cva(
  "text-2xs font-semibold uppercase tracking-eyebrow",
  {
    variants: {
      // Washes are the status colour at low opacity, so a status reads the same
      // everywhere and a palette change is one token edit, not a hunt.
      status: {
        default: "bg-secondary text-secondary-foreground",
        offer: "bg-success/15 text-success",
        featured: "bg-accent/40 text-accent-foreground",
        hero: "bg-info/15 text-info",
        lowStock: "bg-warning/15 text-warning",
        outOfStock: "bg-destructive/15 text-destructive",
        inStock: "bg-success/15 text-success",
        pending: "bg-warning/15 text-warning",
        paid: "bg-success/15 text-success",
        failed: "bg-destructive/15 text-destructive",
      },
    },
    defaultVariants: {
      status: "default",
    },
  }
);

interface StatusBadgeProps extends VariantProps<typeof statusBadgeVariants> {
  children: React.ReactNode;
  className?: string;
}

export function StatusBadge({
  status,
  children,
  className,
}: StatusBadgeProps) {
  return (
    <Badge className={cn(statusBadgeVariants({ status }), className)}>
      {children}
    </Badge>
  );
}

// Specific badge components for common use cases
export function OfferBadge() {
  return <StatusBadge status="offer">Offer</StatusBadge>;
}

export function DefaultBadge() {
  return <StatusBadge status="default">Default</StatusBadge>;
}

export function StockBadge({ stock, threshold = 10 }: { stock: number; threshold?: number }) {
  if (stock === 0) {
    return <StatusBadge status="outOfStock">Out of Stock</StatusBadge>;
  }
  if (stock <= threshold) {
    return <StatusBadge status="lowStock">Low Stock</StatusBadge>;
  }
  return <StatusBadge status="inStock">In Stock</StatusBadge>;
}