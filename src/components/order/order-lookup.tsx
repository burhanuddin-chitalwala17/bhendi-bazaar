// src/components/order/order-lookup.tsx
"use client";

import { useAsyncData } from "@/hooks/core/useAsyncData";
import { useState } from "react";
import { orderApiClient } from "@/services/orderApiClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { OrderSummary } from "./order-summary";
import { SectionHeader } from "../shared/SectionHeader";

export function OrderLookup() {
  const [code, setCode] = useState("");
  const [shouldFetch, setShouldFetch] = useState(false); // Add this

  const {
    data: order,
    loading: isLoading,
    error,
    refetch,
  } = useAsyncData(() => orderApiClient.lookupOrderByCode(code), {
    enabled: shouldFetch,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setShouldFetch(true);
    await refetch();
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 text-sm">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-border/70 bg-card/80 p-5"
      >
        <header className="space-y-1 text-center">
          <SectionHeader
            overline="Track order"
            title="Enter your Bhendi Bazaar order ID to View your order"
          />
        </header>
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-eyebrow">
            Order ID
          </label>
          <Input
            placeholder="e.g. BB-1001"
            value={code}
            onChange={(e) => setCode(e.target.value.trim())}
            autoCapitalize="characters"
            autoCorrect="off"
            className="h-10"
          />
        </div>
        <Button
          type="submit"
          disabled={!code.trim() || isLoading}
          className="w-full rounded-full text-xs font-semibold uppercase tracking-eyebrow"
        >
          {isLoading ? "Searching…" : "Find order"}
        </Button>
        {error && <p className="text-2xs text-destructive">{error}</p>}
      </form>

      {order && (
        <div className="space-y-4">
          <OrderSummary order={order} showShare={true} />
        </div>
      )}
    </div>
  );
}