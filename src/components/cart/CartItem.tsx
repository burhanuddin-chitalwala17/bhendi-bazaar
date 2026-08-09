// NEW FILE: components/cart/CartItem.tsx

"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useCartStore } from "@/store/cartStore";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { StockStatus } from "@/components/shared/StockStatus";
import type { CartItem as CartItemType } from "@/domain/cart";

export function CartItem(item: CartItemType) {
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const [stock, setStock] = useState<number | null>(null);
  const [isLoadingStock, setIsLoadingStock] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Fetch stock
    fetch("/api/products/check-stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ productId: item.productId, quantity: item.quantity }],
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.items?.[0]) {
          setStock(data.items[0].stock);
        }
      })
      .catch((err) => console.error("Failed to fetch stock:", err))
      .finally(() => setIsLoadingStock(false));
  }, [item.productId]);

  const handleIncrease = () => {
    if (isUpdating) return; // Prevent multiple clicks

    if (stock !== null && item.quantity + 1 > stock) {
      toast.error(`Only ${stock} available in stock`);
      return;
    }

    setIsUpdating(true);
    updateQuantity(item.id, item.quantity + 1);
    // Reset after a short delay
    setTimeout(() => setIsUpdating(false), 300);
  };

  const handleDecrease = () => {
    if (isUpdating) return; // Prevent multiple clicks

    setIsUpdating(true);
    if (item.quantity - 1 === 0) {
      removeItem(item.id);
    } else {
      updateQuantity(item.id, item.quantity - 1);
    }
    // Reset after a short delay
    setTimeout(() => setIsUpdating(false), 300);
  };

  const isAtMaxStock = stock !== null && item.quantity >= stock;

  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-card/80 p-3 text-sm">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground/80">
          {item.productName}
        </p>
        {(item.size || item.color) && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {item.size && <span>Size {item.size}</span>}
            {item.color && <span>· {item.color}</span>}
          </div>
        )}
        <div className="flex items-center gap-3 pt-1">
          <span className="text-sm font-semibold">
            {formatCurrency(item.salePrice ?? item.price)}
          </span>
          {item.salePrice && item.salePrice < item.price && (
            <span className="text-xs text-muted-foreground line-through">
              {formatCurrency(item.price)}
            </span>
          )}
        </div>
        {/* Stock Status */}
        {!isLoadingStock && stock !== null && (
          <StockStatus stock={stock} showText size="sm" />
        )}
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center rounded-full border border-border/70 bg-background text-sm">
          <button
            type="button"
            aria-label="Decrease quantity"
            className="flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground active:bg-muted"
            onClick={handleDecrease}
          >
            −
          </button>
          <span className="min-w-[2rem] text-center text-xs font-medium">
            {item.quantity}
          </span>
          <button
            type="button"
            aria-label="Increase quantity"
            className="flex h-9 w-9 items-center justify-center text-muted-foreground hover:text-foreground active:bg-muted disabled:opacity-50"
            onClick={handleIncrease}
            disabled={isAtMaxStock || stock === 0}
          >
            +
          </button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Remove item"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => removeItem(item.id)}
        >
          ×
        </Button>
      </div>
    </div>
  );
}