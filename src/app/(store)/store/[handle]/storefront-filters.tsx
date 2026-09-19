"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Sorting over one shop's catalogue (storefront-browse R3, R4, R9).
 *
 * No "on offer" toggle: what is reduced right now is shown as the offers strip above,
 * which names the actual products rather than asking a shopper to filter and find out.
 * A toggle and a strip of the same thing is two controls for one question. The category rail
 * is `CategoryLanes` above this — the same tiles the marketplace uses, so a shop's
 * categories look like categories rather than like a second idea.
 *
 * No search box: the header's search is the only one, by decision (2026-09-19). It is
 * marketplace-wide, so searching from a shop leaves it — browsing by category is what
 * stays inside. Scoping the header to the current shop would give back a shop-search
 * without a second control, and is the obvious follow-up if this proves wrong.
 *
 * The whole view lives in the query string, so a filtered shop can be shared and
 * reopened (R4) — and because it does, nothing here holds state the URL does not.
 *
 * Scope is not among the parameters: the org comes from the path and is resolved
 * server-side, so no amount of editing this URL can widen a listing past this shop
 * (R7). Mobile-first — the controls wrap rather than hiding below a breakpoint (R9).
 */
export function StorefrontFilters({ handle }: { handle: string }) {
  const router = useRouter();
  const params = useSearchParams();

  const current = { sort: params.get("sort") ?? "" };

  const go = (next: Record<string, string | null>) => {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) query.set(key, value);
      else query.delete(key);
    }
    router.push(`/store/${handle}${query.size ? `?${query}` : ""}`);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={current.sort}
          aria-label="Sort"
          onChange={(event) => go({ sort: event.target.value || null })}
          className={cn("h-8 w-auto py-0 text-sm")}
        >
          <option value="">Newest</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
        </Select>
      </div>
    </div>
  );
}
