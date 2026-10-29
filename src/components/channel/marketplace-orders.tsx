import Link from "next/link";

import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import { ORDER_LINE_STATE, type MarketplaceOrderDTO } from "@server/channels/channel-stock.types";

import { MARKETPLACE_ORDERS } from "./stock-copy";

/** The Marketplace orders tab (inventory-sync Q10): read-only, newest first, amounts as reported. */
export function MarketplaceOrders({ orders, hasMore, moreHref }: { orders: MarketplaceOrderDTO[]; hasMore: boolean; moreHref: string }) {
  if (orders.length === 0) return <p className="rounded-card border bg-card p-4 text-sm text-muted-foreground">{MARKETPLACE_ORDERS.empty}</p>;
  return (
    <div className="flex flex-col gap-3">
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {orders.map((o) => (
          <li key={o.id} className="flex flex-col gap-1 rounded-card border bg-card p-4 text-sm">
            <div className="flex justify-between gap-2">
              <strong>{o.label}</strong>
              <span className="text-muted-foreground">{formatDate(o.orderedAt, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
            </div>
            <span>
              SKU {o.sku} × {o.quantity}
            </span>
            <span className="text-muted-foreground">{MARKETPLACE_ORDERS.line(o.orderId, o.amountPaise === null ? null : formatCurrency(o.amountPaise), o.label)}</span>
            <span className="flex flex-wrap gap-2">
              {o.oversold && <span className="rounded-full bg-destructive/10 px-2 text-xs font-semibold text-destructive">{MARKETPLACE_ORDERS.oversold}</span>}
              {o.beforeSync && <span className="rounded-full bg-muted px-2 text-xs text-muted-foreground">{MARKETPLACE_ORDERS.beforeSync}</span>}
              {o.unlinked && <span className="rounded-full bg-warning/10 px-2 text-xs text-warning">{MARKETPLACE_ORDERS.unlinked}</span>}
              {o.locationGuessed && <span className="rounded-full bg-warning/10 px-2 text-xs text-warning">{MARKETPLACE_ORDERS.locationGuessed}</span>}
              {o.state === ORDER_LINE_STATE.CANCELLED && <span className="text-xs text-muted-foreground">{MARKETPLACE_ORDERS.cancelled}</span>}
            </span>
          </li>
        ))}
      </ul>
      {hasMore && (
        <Button asChild variant="outline" className="min-h-10 w-full">
          <Link href={moreHref}>{MARKETPLACE_ORDERS.showMore}</Link>
        </Button>
      )}
    </div>
  );
}
