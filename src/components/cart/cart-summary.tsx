"use client";

import Link from "next/link";

import { useCartStore } from "@/store/cartStore";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ActionBar } from "@/components/shared/action-bar";
import { EmptyState } from "@/components/shared/states/EmptyState";
import { SkeletonRows } from "@/components/shared/states/skeletons";
import { formatCurrency } from "@/lib/format";
import { CartLineItems } from "./cart-line-items";
import { CART_COPY } from "./cart-copy";
import { ROUTES } from "@server/shared/routes";

/**
 * The bag: lines by shop, the running total, and Checkout docked above the tab bar on a phone
 * (inline in the summary from a tablet up). Figures are the catalogue's; checkout prices the order.
 */
export function CartView() {
  const items = useCartStore((state) => state.items);
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const { subtotal, discount, total } = useCartStore((state) => state.totals);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  // Until the saved bag is read, "empty" would be a claim about nothing.
  if (!hasHydrated) {
    return <SkeletonRows count={2} />;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        tone="gold"
        title={CART_COPY.emptyTitle}
        description={CART_COPY.emptyBody}
        action={{ label: CART_COPY.startShopping, href: ROUTES.shopAll }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-small text-muted-foreground">{CART_COPY.count(count)}</p>
      <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-10">
        <CartLineItems items={items} />
        <aside className="space-y-3 self-start rounded-card border border-border bg-card p-4 md:sticky md:top-20">
          <h2 className="font-heading text-title font-semibold">{CART_COPY.summary}</h2>
          <dl className="space-y-2 text-small">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{CART_COPY.items}</dt>
              <dd className="tabular-nums">{formatCurrency(subtotal)}</dd>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-success">
                <dt>{CART_COPY.offers}</dt>
                <dd className="tabular-nums">−{formatCurrency(discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{CART_COPY.delivery}</dt>
              <dd className="text-muted-foreground">{CART_COPY.deliveryLater}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-body font-semibold">
              <dt>{CART_COPY.totalSoFar}</dt>
              <dd className="tabular-nums">{formatCurrency(total)}</dd>
            </div>
          </dl>
          {/* StoreCart's coupon row. A code is priced against the order, so it is entered at checkout. */}
          <Link
            href={ROUTES.checkout}
            prefetch={false}
            className="flex min-h-12 items-center gap-3 rounded-card border border-dashed border-border px-3 text-small text-foreground transition-colors duration-fast ease-standard hover:border-primary/40"
          >
            <Icon name="offer" size="md" />
            <span className="flex-1">{CART_COPY.couponAtCheckout}</span>
            <Icon name="next" size="sm" tone="muted" />
          </Link>
          <p className="flex items-center gap-2 text-caption text-muted-foreground">
            <Icon name="secure" size="xs" />
            {CART_COPY.payMethods}
          </p>
          <Button asChild size="lg" className="hidden w-full rounded-full md:inline-flex">
            <Link href={ROUTES.checkout} prefetch={false}>{CART_COPY.checkout}</Link>
          </Button>
        </aside>
      </div>

      <ActionBar
        className="-mx-3 sm:-mx-6 md:hidden"
        status={
          <span className="flex flex-col">
            <span className="text-title font-semibold tabular-nums text-foreground">{formatCurrency(total)}</span>
            {discount > 0 && <span className="text-success">{CART_COPY.youSave(formatCurrency(discount))}</span>}
          </span>
        }
      >
        <Button asChild size="lg" className="rounded-full px-8">
          <Link href={ROUTES.checkout} prefetch={false}>{CART_COPY.checkout}</Link>
        </Button>
      </ActionBar>
    </div>
  );
}
