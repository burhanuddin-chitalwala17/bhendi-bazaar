"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ORDER_STATUS, PAYMENT_STATUS } from "@server/checkout/order.types";
import { titleCase } from "@/lib/format";

/**
 * The console's order filters, held in the URL so the server can answer the question the URL
 * asks ([ADR-0034]). A filtered view is then shareable and survives the back button, which
 * `useState` never gave.
 *
 * The option lists are derived from `ORDER_STATUS` and `PAYMENT_STATUS` rather than retyped:
 * they were eleven string literals, which is how a filter comes to offer a status the domain
 * has stopped using.
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
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex flex-1 gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && apply({ search })}
          placeholder="Search by code, customer, email..."
        />
        <Button variant="default" onClick={() => apply({ search })} className="flex items-center gap-2">
          <Search className="size-4" />
          Search
        </Button>
      </div>

      <Select value={params.get("status") ?? ""} onChange={(e) => apply({ status: e.target.value })}>
        <option value="">All Statuses</option>
        {Object.values(ORDER_STATUS).map((status) => (
          <option key={status} value={status}>{titleCase(status)}</option>
        ))}
      </Select>

      <Select
        value={params.get("paymentStatus") ?? ""}
        onChange={(e) => apply({ paymentStatus: e.target.value })}
      >
        <option value="">All Payments</option>
        {Object.values(PAYMENT_STATUS).map((status) => (
          <option key={status} value={status}>{titleCase(status)}</option>
        ))}
      </Select>
    </div>
  );
}
