"use client";

import { useAsyncData } from "@/hooks/core/useAsyncData";
import { useId, useState } from "react";
import { orderApiClient } from "./orderApiClient";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { OrderSummary } from "./order-summary";
import { PageHeader } from "@/components/shared/page-shell";

export function OrderLookup() {
  const [code, setCode] = useState("");
  const [shouldFetch, setShouldFetch] = useState(false);
  const [missing, setMissing] = useState(false);
  const codeId = useId();

  const {
    data: order,
    loading: isLoading,
    error,
    refetch,
  } = useAsyncData((signal) => orderApiClient.lookupOrderByCode(code, signal), {
    enabled: shouldFetch,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Never a dead button (ADR-0053): an empty tap says what is needed.
    setMissing(!code.trim());
    if (!code.trim()) return;
    setShouldFetch(true);
    await refetch();
  }

  return (
    <div className="flex max-w-md flex-col gap-6 text-small">
      <PageHeader title="Track an order" description="Enter the order ID from your confirmation email." />
      <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-card border border-border bg-card p-5">
        <div className="space-y-2">
          <Label htmlFor={codeId}>
            Order ID
          </Label>
          <Input
            id={codeId}
            placeholder="e.g. BB-7KQ4MNZP"
            value={code}
            onChange={(e) => setCode(e.target.value.trim())}
            autoCapitalize="characters"
            autoCorrect="off"
            aria-invalid={missing || undefined}
            className="h-10"
          />
        </div>
        <Button type="submit" size="lg" pending={isLoading} className="w-full rounded-full">
          Find order
        </Button>
        {missing && <p role="alert" className="text-caption text-destructive">Enter your order ID first.</p>}
        {error && <p role="alert" className="text-caption text-destructive">{error}</p>}
      </form>

      {order && (
        <div className="space-y-4">
          <OrderSummary order={order} showShare={true} />
        </div>
      )}
    </div>
  );
}
