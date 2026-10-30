"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ORDER_STATUS } from "@server/checkout/order.types";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: ORDER_STATUS.CONFIRMED, label: "Confirmed" },
  { value: ORDER_STATUS.PROCESSING, label: "Processing" },
  { value: ORDER_STATUS.PACKED, label: "Packed" },
  { value: ORDER_STATUS.SHIPPED, label: "Shipped" },
  { value: ORDER_STATUS.DELIVERED, label: "Delivered" },
  { value: ORDER_STATUS.CANCELLED, label: "Cancelled" },
];

export function OrgOrdersFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(params.get("search") ?? "");

  const go = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  };

  const handleSearch = () => go({ search: searchTerm.trim() });

  return (
    <div className="flex flex-wrap gap-3 rounded-card border border-border bg-card p-4">
      <div className="flex min-w-0 grow gap-2 sm:min-w-64">
        <Input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Search by order code…"
          className="flex-1"
        />
        <Button variant="default" onClick={handleSearch}>
          <Search className="h-4 w-4" />
        </Button>
      </div>
      <Select
        value={params.get("status") ?? ""}
        onChange={(e) => go({ status: e.target.value })}
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
