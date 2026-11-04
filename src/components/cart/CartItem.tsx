"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";

import { useCartStore } from "@/store/cartStore";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PriceDisplay } from "@/components/shared/PriceDisplay";
import { StockStatus } from "@/components/shared/StockStatus";
import type { CartItem as CartItemType } from "@/domain/cart";

/** One line of the bag. Stock arrives from CartLineItems, which checks the whole bag in one request. */
export function CartItem({
  item,
  stock,
  isLoadingStock,
  onMoveToSaved,
}: {
  item: CartItemType;
  stock: number | null;
  isLoadingStock: boolean;
  /** Present when the buyer can save (signed in); a guest's heart would only open sign-in. */
  onMoveToSaved?: (item: CartItemType) => void;
}) {
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  // A quick double tap on +/- is one step, not two.
  const [isUpdating, setIsUpdating] = useState(false);

  const step = (next: number) => {
    if (isUpdating) return;
    setIsUpdating(true);
    if (next === 0) removeItem(item.id);
    else updateQuantity(item.id, next);
    setTimeout(() => setIsUpdating(false), 300);
  };

  const increase = () => {
    // Never disabled (ADR-0053): the tap says why it can't go higher.
    if (stock !== null && item.quantity + 1 > stock) {
      toast.error(stock === 0 ? "This piece has sold out" : `Only ${stock} available`);
      return;
    }
    step(item.quantity + 1);
  };

  const variant = [item.size && `Size ${item.size}`, item.color].filter(Boolean).join(" · ");

  return (
    <li className="flex gap-3 py-4">
      <Link href={`/product/${item.productSlug}`} prefetch={false} className="relative aspect-4/5 w-20 shrink-0 overflow-hidden rounded-field bg-muted md:w-24">
        <Image src={item.thumbnail} alt={item.productName} fill sizes="96px" className="object-cover" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link href={`/product/${item.productSlug}`} prefetch={false} className="line-clamp-2 text-small font-medium text-foreground">
          {item.productName}
        </Link>
        {variant && <p className="text-caption text-muted-foreground">{variant}</p>}
        <PriceDisplay price={item.price} salePrice={item.salePrice} size="sm" showBadge={false} />
        {!isLoadingStock && stock !== null && <StockStatus stock={stock} size="xs" variant="warn-only" />}

        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center rounded-full border border-border">
            <Button variant="ghost" shape="icon" size="lg" type="button" aria-label="One fewer" className="rounded-full" onClick={() => step(item.quantity - 1)}>
              <Icon name="remove" size="sm" />
            </Button>
            <span className="min-w-6 text-center text-small font-medium tabular-nums" aria-live="polite">
              {item.quantity}
            </span>
            <Button variant="ghost" shape="icon" size="lg" type="button" aria-label="One more" className="rounded-full" onClick={increase}>
              <Icon name="add" size="sm" />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            {onMoveToSaved && (
              <Button variant="link" size="sm" type="button" className="px-2 text-muted-foreground" onClick={() => onMoveToSaved(item)}>
                Move to saved
              </Button>
            )}
            <Button variant="link" size="sm" type="button" className="px-2 text-muted-foreground" onClick={() => removeItem(item.id)}>
              Remove
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}
