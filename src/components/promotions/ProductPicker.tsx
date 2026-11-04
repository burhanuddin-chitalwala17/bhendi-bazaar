"use client";

/**
 * Choosing which products an offer covers.
 *
 * Searches the server rather than filtering a preloaded list. A capped fetch with
 * client-side filtering works until the catalogue outgrows the cap, and then stops
 * finding things with nothing on screen to say so — the worst kind of limit, because
 * it looks like the product does not exist.
 *
 * Already-selected products are fetched by id and always shown, so a choice the offer
 * has already made never disappears just because it is off the current page.
 */

import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { useDebouncedSearch } from "@/hooks/core/useDebouncedSearch";
import { productSearchApiClient } from "@/components/promotions/productSearchApiClient";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRODUCT_PICKER_COPY } from "./promotions-copy";

export interface TargetOption {
  id: string;
  name: string;
}

interface ProductPickerProps {
  /** Where to search. The endpoint is scoped by the route that renders this. */
  searchPath: string;
  /** First page, loaded on the server so the picker is not empty on arrival. */
  initial: TargetOption[];
  initialTotal: number;
  /** Products this offer already names, whatever page they fall on. */
  selectedOptions: TargetOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  required?: boolean;
  error?: string;
}

export function ProductPicker({
  searchPath,
  initial,
  initialTotal,
  selectedOptions,
  value,
  onChange,
  required,
  error,
}: ProductPickerProps) {
  const [term, setTerm] = useState("");
  const search = useDebouncedSearch(
    term,
    (query, signal) => productSearchApiClient.search(searchPath, query, signal),
    { skipEmpty: true, dependencies: [searchPath] },
  );
  // Until a search has answered, the page the server rendered is what there is.
  const results = search.data?.products ?? initial;
  const total = search.data?.total ?? initialTotal;
  const { isSearching } = search;

  // Selected first, then the page, with no duplicates.
  const shown = useMemo(() => {
    const seen = new Set<string>();
    const pinned = selectedOptions.filter((option) => {
      seen.add(option.id);
      return true;
    });
    return [...pinned, ...results.filter((option) => !seen.has(option.id))];
  }, [selectedOptions, results]);

  const toggle = (id: string) =>
    onChange(
      value.includes(id) ? value.filter((x) => x !== id) : [...value, id],
    );

  const hidden = Math.max(0, total - results.length);

  return (
    <div>
      <Label className="text-sm" htmlFor="offer-product-search">
        {PRODUCT_PICKER_COPY.products} {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="relative mt-1.5">
        <Icon
          name="search"
          tone="muted"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
        />
        <Input
          id="offer-product-search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={PRODUCT_PICKER_COPY.find}
          className="pl-9"
        />
      </div>

      <div className="mt-2 max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
        {shown.map((product) => (
          <Checkbox
            key={product.id}
            label={product.name}
            checked={value.includes(product.id)}
            onChange={() => toggle(product.id)}
          />
        ))}
        {shown.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {isSearching ? PRODUCT_PICKER_COPY.searching : PRODUCT_PICKER_COPY.nothing}
          </p>
        )}
      </div>

      {/* Say what is not on screen. A silent cap reads as "no such product". */}
      <p className="mt-1.5 text-xs text-muted-foreground">
        {value.length > 0 && PRODUCT_PICKER_COPY.selected(value.length)}
        {hidden > 0 ? PRODUCT_PICKER_COPY.showing(results.length, total) : PRODUCT_PICKER_COPY.count(total)}
      </p>

      {search.error && (
        <p className="mt-1.5 text-sm text-destructive">{search.error}</p>
      )}
      {error && <p className="mt-1.5 text-sm text-destructive">{error}</p>}
    </div>
  );
}
