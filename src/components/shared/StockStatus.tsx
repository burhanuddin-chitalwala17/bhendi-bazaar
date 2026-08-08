// components/shared/StockStatus.tsx

import { cn } from "@/lib/utils";

interface StockStatusProps {
  stock: number;
  lowStockThreshold?: number;
  cartQuantity?: number;
  showText?: boolean;
  size?: "sm" | "md";
}

export function StockStatus({
  stock,
  lowStockThreshold = 10,
  cartQuantity = 0,
  showText = true,
  size = "md",
}: StockStatusProps) {
  const isOutOfStock = stock === 0;
  const isLowStock = stock > 0 && stock <= lowStockThreshold;
  const remaining = stock - cartQuantity;

  const status = isOutOfStock
    ? { color: "bg-destructive", textColor: "text-destructive", label: "Out of Stock" }
    : isLowStock
    ? {
        color: "bg-warning",
        textColor: "text-warning",
        label: `Only ${stock} left in stock!`,
      }
    : {
        color: "bg-success",
        textColor: "text-success",
        label: "In Stock",
      };

  const dotSize = size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2";
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className={cn("inline-block rounded-full", status.color, dotSize)} />
        {showText && (
          <span className={cn("font-medium", status.textColor, textSize)}>
            {status.label}
          </span>
        )}
      </div>
      {cartQuantity > 0 && remaining > 0 && (
        <p className="text-xs text-muted-foreground">
          {cartQuantity} in cart • {remaining} more available
        </p>
      )}
    </div>
  );
}