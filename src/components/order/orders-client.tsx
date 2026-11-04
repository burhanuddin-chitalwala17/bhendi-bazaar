"use client";

import { useMemo, useState } from "react";
import type { Order } from "@/domain/order";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "../shared/states/EmptyState";
import { PageHeader } from "../shared/page-shell";
import { PriceDisplay } from "../shared/PriceDisplay";
import { formatDate } from "@/lib/format";
import { ORDERS_CLIENT_COPY } from "./order-copy";
import { ROUTES } from "@server/shared/routes";

/** The list and the search box that filters it; orders arrive as props from the server page (ADR-0034). */
export function OrdersClient({ orders }: { orders: Order[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (order) =>
        order.code.toLowerCase().includes(q) ||
        order.address.fullName.toLowerCase().includes(q),
    );
  }, [orders, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <PageHeader title={ORDERS_CLIENT_COPY.yourOrders} back={{ href: ROUTES.profile, label: ORDERS_CLIENT_COPY.account }} />
        <div className="w-full md:max-w-xs">
          <Input
            type="search"
            aria-label={ORDERS_CLIENT_COPY.searchOrders}
            placeholder={ORDERS_CLIENT_COPY.searchOrderIdName}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10"
          />
        </div>
      </div>
      {filtered.length === 0 ? (
        query.trim() ? (
          <EmptyState title={ORDERS_CLIENT_COPY.noOrdersMatch} description={ORDERS_CLIENT_COPY.tryOrderIdFrom} />
        ) : (
          <EmptyState
            title={ORDERS_CLIENT_COPY.noOrdersYet}
            description={ORDERS_CLIENT_COPY.oncePlaceOrderShows}
            action={{ label: ORDERS_CLIENT_COPY.startShopping, href: ROUTES.shopAll }}
          />
        )
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const totalItems = order.shipments.reduce(
              (sum, shipment) => sum + shipment.items.length,
              0,
            );

            return (
              <Link
                prefetch={false}
                key={order.id}
                href={ROUTES.order(order.id)}
                className="flex items-center justify-between gap-3 rounded-card border border-border bg-card p-4 text-small transition-colors duration-fast hover:border-primary/40"
              >
                <div className="space-y-1">
                  <p className="font-semibold">
                    {order.code} ·{" "}
                    {formatDate(order.createdAt, {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                  <p className="text-muted-foreground">
                    {order.address.fullName} · {totalItems === 1 ? "1 item" : `${totalItems} items`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <PriceDisplay price={order.grandTotal} size="sm" />
                  <Icon name="next" size="sm" tone="muted" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
