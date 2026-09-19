"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Select } from "@/components/ui/select";
import {
  PRODUCT_SORTS,
  PRODUCT_SORT_LABELS,
  type ProductSort,
} from "@/lib/product-paging";

/**
 * How a listing is ordered, as a control.
 *
 * The choice lives in the URL, not in state: a sorted listing can then be shared and
 * reopened, and the server renders the first page already in that order rather than
 * the grid re-sorting what it was given. Picking a sort is a navigation, which also
 * resets the paging — page two of the old order would otherwise be appended beneath
 * page one of the new one.
 *
 * Prices here are **offer prices** — see `PRODUCT_SORTS`. What a shopper sees on a
 * tile and what this orders by come from one function, so a reduced item sorts where
 * its reduced price belongs.
 */
export function ProductSortSelect({ basePath }: { basePath: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const current = (params.get("sort") ?? "newest") as ProductSort;

  return (
    <Select
      value={current}
      aria-label="Sort products"
      className="h-9 w-auto py-0 text-sm"
      onChange={(event) => {
        const next = event.target.value as ProductSort;
        const query = new URLSearchParams(params.toString());
        // The default is the absence of the parameter, so the plain listing keeps a
        // plain URL and a shared link does not carry a choice nobody made.
        if (next === "newest") query.delete("sort");
        else query.set("sort", next);
        router.push(`${basePath}${query.size ? `?${query}` : ""}`);
      }}
    >
      {PRODUCT_SORTS.map((sort) => (
        <option key={sort} value={sort}>
          {PRODUCT_SORT_LABELS[sort]}
        </option>
      ))}
    </Select>
  );
}
