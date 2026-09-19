"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface ShopCategory {
  slug: string;
  name: string;
}

/**
 * Search, categories and filters that see one shop and nothing else
 * (storefront-browse R1–R4, R9).
 *
 * The whole view lives in the query string, so a filtered shop can be shared and
 * reopened (R4) — and because it does, nothing here holds state the URL does not.
 *
 * Scope is not among the parameters: the org comes from the path and is resolved
 * server-side, so no amount of editing this form can widen the search past this shop
 * (R7). Mobile-first — the search row and the category bar each have a phone form
 * rather than a desktop one hidden below a breakpoint (R9).
 */
export function StorefrontFilters({
  handle,
  categories,
}: {
  handle: string;
  categories: ShopCategory[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [term, setTerm] = useState(params.get("q") ?? "");

  const current = {
    category: params.get("category") ?? "",
    sort: params.get("sort") ?? "",
    offers: params.get("offers") === "1",
  };

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
      <form
        onSubmit={(event) => {
          event.preventDefault();
          go({ q: term.trim() || null });
        }}
        className="flex gap-2"
      >
        <Input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search this shop"
          aria-label="Search this shop"
          className="flex-1"
        />
        <Button type="submit" size="icon" aria-label="Search">
          <Search />
        </Button>
      </form>

      {categories.length > 0 && (
        // A horizontal rail on a phone: chips stay tappable and the row scrolls rather
        // than wrapping into a wall of them.
        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <Button
            variant={current.category ? "outline" : "default"}
            size="sm"
            className="shrink-0"
            onClick={() => go({ category: null })}
          >
            Everything
          </Button>
          {categories.map((category) => (
            <Button
              key={category.slug}
              variant={current.category === category.slug ? "default" : "outline"}
              size="sm"
              className="shrink-0"
              onClick={() => go({ category: category.slug })}
            >
              {category.name}
            </Button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={current.offers ? "default" : "outline"}
          size="sm"
          onClick={() => go({ offers: current.offers ? null : "1" })}
        >
          On offer
        </Button>
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
