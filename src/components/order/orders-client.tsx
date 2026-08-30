"use client";

import { useMemo, useState } from "react";
import { useAsyncData } from "@/hooks/core/useAsyncData";
import { orderApiClient } from "@/services/orderApiClient";
import { formatCurrency } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "../shared/states/LoadingSpinner";
import { ErrorState } from "../shared/states/ErrorState";
import Link from "next/link";
import { ChevronRight, Package } from "lucide-react";
import { EmptyState } from "../shared/states/EmptyState";
import { SectionHeader } from "../shared/SectionHeader";
import { PriceDisplay } from "../shared/PriceDisplay";

export function OrdersClient() {
  const [query, setQuery] = useState("");
  const {
    data: orders,
    loading: isLoading,
    error,
    refetch,
  } = useAsyncData(() => orderApiClient.getOrders(), {
    refetchDependencies: [],
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders?.filter(
      (order) =>
        order.code.toLowerCase().includes(q) ||
        order.address.fullName.toLowerCase().includes(q)
    );
  }, [orders, query]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorState message={error} retry={refetch} />;
  }

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
      {filtered?.length === 0 ? (
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
            {filtered?.map((order) => {
              const totalItems = order.shipments.reduce(
                (sum, shipment) => sum + shipment.items.length,
                0
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


