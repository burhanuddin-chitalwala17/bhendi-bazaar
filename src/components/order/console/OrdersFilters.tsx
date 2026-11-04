"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PAYMENT_STATUS } from "@server/checkout/order.types";
import { paymentChip } from "./order-status";
import { ORDERS_FILTERS_COPY } from "./console-copy";

/**
 * The console's order filters, held in the URL so the server can answer the question the URL
 * asks ([ADR-0034]). A filtered view is then shareable and survives the back button, which
 * `useState` never gave.
 *
 * The order status is the page's tabs; payment is derived from `PAYMENT_STATUS` rather than
 * retyped, which is how a filter comes to offer a status the domain has stopped using.
 */
export function OrdersFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("search") ?? "");

  const apply = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center">
      <div className="flex flex-1 gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && apply({ search })}
          placeholder={ORDERS_FILTERS_COPY.orderCodeBuyerEmail}
          aria-label={ORDERS_FILTERS_COPY.searchOrders}
        />
        <Button variant="default" onClick={() => apply({ search })}>
          <Icon name="search" />{ORDERS_FILTERS_COPY.search}</Button>
      </div>

      <Select
        value={params.get("paymentStatus") ?? ""}
        onChange={(e) => apply({ paymentStatus: e.target.value })}
        aria-label={ORDERS_FILTERS_COPY.payment}
      >
        <option value="">{ORDERS_FILTERS_COPY.anyPayment}</option>
        {Object.values(PAYMENT_STATUS).map((status) => (
          <option key={status} value={status}>{paymentChip(status).label}</option>
        ))}
      </Select>
    </div>
  );
}
