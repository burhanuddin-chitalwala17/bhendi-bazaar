"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Select } from "@/components/ui/select";
import {
  PRODUCT_SORTS,
  PRODUCT_SORT_LABELS,
  type ProductSort,
} from "@/lib/product-paging";
import { PRODUCT_SORT_SELECT_COPY } from "./shared-copy";

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
  // The URL changes only when the new page arrives; without this the control snaps back to the
  // old sort meanwhile and the pick looks ignored. A pick holds only while the URL it was made on
  // stands, so Back or a link shows the URL's sort again.
  const [picked, setPicked] = useState<{ on: ProductSort; value: ProductSort } | null>(null);
  const pending = picked !== null && picked.on === current && picked.value !== current;
  const shown = pending ? picked.value : current;

  return (
    <Select
      value={shown}
      aria-label={PRODUCT_SORT_SELECT_COPY.sortProducts}
      aria-busy={pending}
      className={`h-9 w-auto py-0 text-sm transition-opacity ${pending ? "opacity-60" : ""}`}
      onChange={(event) => {
        const next = event.target.value as ProductSort;
        const query = new URLSearchParams(params.toString());
        // The default is the absence of the parameter, so the plain listing keeps a
        // plain URL and a shared link does not carry a choice nobody made.
        if (next === "newest") query.delete("sort");
        else query.set("sort", next);
        setPicked({ on: current, value: next });
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
