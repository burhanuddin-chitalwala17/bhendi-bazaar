"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/store/cartStore";
import { Button } from "@/components/ui/button";
import { PriceDisplay } from "../shared/PriceDisplay";

export function CartSummary() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);
  const { subtotal, discount, total } = useCartStore((state) => state.totals);
  const hasItems = items.length > 0;

  const handleCheckout = () => {
    router.push("/checkout");
  };

  return (
    <aside className="space-y-3 rounded-xl border border-border/70 bg-card/80 p-4 text-sm">
      <header>
        <p className="text-2xs font-semibold uppercase tracking-display text-muted-foreground/80">
          Summary
        </p>
      </header>
      <div className="space-y-1 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <PriceDisplay price={subtotal} size="sm" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Savings</span>
          <PriceDisplay price={discount} size="sm" />
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-dashed border-border/70 pt-2 text-sm font-semibold">
          <span>Total</span>
          <PriceDisplay price={total} size="sm" />
        </div>
      </div>

      <Button
        asChild
        variant="outline"
        className="w-full rounded-full text-xs font-semibold uppercase tracking-eyebrow"
      >
        <Link href="/">Add More</Link>
      </Button>
      <Button
        disabled={!hasItems}
        onClick={handleCheckout}
        className="mt-2 w-full rounded-full text-xs font-semibold uppercase tracking-eyebrow"
      >
        Proceed to checkout
      </Button>
    </aside>
  );
}