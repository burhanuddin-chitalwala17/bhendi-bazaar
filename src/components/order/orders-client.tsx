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
        <PageHeader title="Your orders" back={{ href: "/profile", label: "Account" }} />
        <div className="w-full md:max-w-xs">
          <Input
            type="search"
            aria-label="Search your orders"
            placeholder="Search by order ID or name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10"
          />
        </div>
      </div>
      {filtered.length === 0 ? (
        query.trim() ? (
          <EmptyState title="No orders match" description="Try the order ID from your confirmation email." />
        ) : (
          <EmptyState
            title="No orders yet"
            description="Once you place an order, it shows up here with every parcel's progress."
            action={{ label: "Start shopping", href: "/shop" }}
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
                href={`/order/${order.id}`}
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
