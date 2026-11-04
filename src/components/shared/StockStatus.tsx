import { cn } from "@/lib/utils";
import { STOCK_STATUS_COPY } from "@/components/shared/shared-copy";

interface StockStatusProps {
  stock: number;
  lowStockThreshold?: number;
  cartQuantity?: number;
  showText?: boolean;
  size?: "xs" | "sm" | "md";
  /** "warn-only" renders nothing when stock is healthy — a green "In Stock" dot on
   *  every tile of a dense grid is noise that hides the tiles that actually warn. */
  variant?: "full" | "warn-only";
}

export function StockStatus({
  stock,
  lowStockThreshold = 10,
  cartQuantity = 0,
  showText = true,
  size = "md",
  variant = "full",
}: StockStatusProps) {
  const isOutOfStock = stock === 0;
  const isLowStock = stock > 0 && stock <= lowStockThreshold;
  const remaining = stock - cartQuantity;
  const isXs = size === "xs";

  if (variant === "warn-only" && !isOutOfStock && !isLowStock) return null;

  const status = isOutOfStock
    ? {
        color: "bg-destructive",
        textColor: "text-destructive",
        label: STOCK_STATUS_COPY.soldOut,
      }
    : isLowStock
      ? {
          color: "bg-warning",
          textColor: "text-warning",
          label: STOCK_STATUS_COPY.onlyLeft(stock),
        }
      : {
          color: "bg-success",
          textColor: "text-success",
          label: STOCK_STATUS_COPY.inStock,
        };

  const dotSize = isXs ? "h-1 w-1" : size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2";
  const textSize = isXs ? "text-caption" : "text-small";

  return (
    <div className="space-y-1">
      <div className={cn("flex items-center", isXs ? "gap-1" : "gap-2")}>
        <span
          className={cn(
            "inline-block shrink-0 rounded-full",
            status.color,
            dotSize,
          )}
        />
        {showText && (
          <span
            className={cn("truncate font-medium", status.textColor, textSize)}
          >
            {status.label}
          </span>
        )}
      </div>
      {cartQuantity > 0 && remaining > 0 && (
        <p className="text-caption text-muted-foreground">
          {cartQuantity} in your bag · {remaining} more available
        </p>
      )}
    </div>
  );
}
