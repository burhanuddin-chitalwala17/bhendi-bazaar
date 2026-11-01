"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";

import { useCartCount } from "./themed-cart-count";

/** The header's cart, from `md` up; on a phone the tab bar carries it (ADR-0016). */
export function ThemedCartLink() {
  const count = useCartCount();
  return (
    <Link
      href="/cart"
      prefetch={false}
      aria-label={count > 0 ? `Cart, ${count} items` : "Cart"}
      className="relative hidden shrink-0 text-foreground md:inline-flex"
    >
      <ShoppingBag className="size-5" />
      {count > 0 && (
        <span className="absolute -right-2 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-4xs font-semibold leading-none text-primary-foreground">
          {count}
        </span>
      )}
    </Link>
  );
}
