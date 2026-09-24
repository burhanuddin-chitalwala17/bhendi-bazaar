"use client";

import { useMemo, useState } from "react";
import type { Order } from "@/domain/order";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { ChevronRight, Package } from "lucide-react";
import { EmptyState } from "../shared/states/EmptyState";
import { SectionHeader } from "../shared/SectionHeader";
import { PriceDisplay } from "../shared/PriceDisplay";

/**
 * The search box, and the list it filters. Orders arrive as props from the server
 * component above — this client component exists for the filter and nothing else, so
 * there is no fetch, no loading state and no error state to render ([ADR-0034]).
 */
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SectionHeader
          overline="Orders"
          title="Your order history with Bhendi Bazaar"
        />
        <div className="w-full max-w-xs">
          <Input
            placeholder="Search by code or name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-10"
          />
        </div>
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No Orders Yet"
          description={
            query.trim()
              ? "No orders match your search."
              : "Once you place an order, it will show up here."
          }
        />
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
                className="flex flex-col justify-between gap-2 rounded-xl border border-border/70 bg-card/80 p-4 text-xs transition-colors hover:border-primary/40 hover:bg-card sm:flex-row sm:items-center"
              >
                <div className="space-y-1">
                  <p className="font-semibold">
                    {order.code} ·{" "}
                    {new Date(order.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                  <p className="text-muted-foreground">
                    {order.address.fullName} · {totalItems} items
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-semibold">
                    <PriceDisplay price={order.grandTotal} size="sm" />
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
