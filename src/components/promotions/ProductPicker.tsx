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

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
  const [results, setResults] = useState<TargetOption[]>(initial);
  const [total, setTotal] = useState(initialTotal);
  const [isSearching, setIsSearching] = useState(false);

  // Debounced, so typing a word is one query rather than one per keystroke.
  useEffect(() => {
    if (term === "") {
      setResults(initial);
      setTotal(initialTotal);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`${searchPath}?q=${encodeURIComponent(term)}`);
        if (response.ok) {
          const data = (await response.json()) as { products: TargetOption[]; total: number };
          setResults(data.products);
          setTotal(data.total);
        }
      } finally {
        setIsSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [term, searchPath, initial, initialTotal]);

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
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  const hidden = Math.max(0, total - results.length);

  return (
    <div>
      <Label className="text-sm" htmlFor="offer-product-search">
        Products {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="relative mt-1.5">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id="offer-product-search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Find a product"
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
            {isSearching ? "Searching…" : "Nothing matches that."}
          </p>
        )}
      </div>

      {/* Say what is not on screen. A silent cap reads as "no such product". */}
      <p className="mt-1.5 text-xs text-muted-foreground">
        {value.length > 0 && `${value.length} selected · `}
        {hidden > 0
          ? `showing ${results.length} of ${total} — search to narrow`
          : `${total} product${total === 1 ? "" : "s"}`}
      </p>

      {error && <p className="mt-1.5 text-sm text-destructive">{error}</p>}
    </div>
  );
}
