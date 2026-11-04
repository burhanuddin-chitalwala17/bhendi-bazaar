"use client";

import { useState } from "react";

import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ProductFilters } from "../../types";
import { PRODUCT_CONSOLE_COPY } from "../../console-copy";

interface ProductsFiltersProps {
  filters: ProductFilters;
  categories: Array<{ id: string; name: string }>;
  onFilterChange: (filters: Partial<ProductFilters>) => void;
}

/** Search, then the narrower filters. Shelf and stock are the tabs above, not here. */
export function ProductsFilters({ filters, categories, onFilterChange }: ProductsFiltersProps) {
  const [searchTerm, setSearchTerm] = useState(filters.search || "");

  return (
    <div className="space-y-3 md:flex md:items-center md:gap-4 md:space-y-0">
      <form
        role="search"
        className="flex min-w-0 flex-1 gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          onFilterChange({ search: searchTerm.trim() || undefined, page: 1 });
        }}
      >
        <Input
          id="search"
          type="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={PRODUCT_CONSOLE_COPY.list.searchPlaceholder}
          aria-label={PRODUCT_CONSOLE_COPY.list.searchLabel}
          className="flex-1"
        />
        <Button type="submit" variant="outline" shape="icon" aria-label={PRODUCT_CONSOLE_COPY.list.search}>
          <Icon name="search" size="sm" />
        </Button>
      </form>

      <div className="flex items-center gap-4">
        <Select
          value={filters.categoryId || ""}
          onChange={(e) => onFilterChange({ categoryId: e.target.value || undefined, page: 1 })}
          aria-label={PRODUCT_CONSOLE_COPY.list.category}
          className="min-w-0 flex-1 md:w-48 md:flex-none"
        >
          <option value="">{PRODUCT_CONSOLE_COPY.list.allCategories}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>

        {/* Wishlisted only goes through onFilterChange like the others: the server picks the page. */}
        <div className="flex shrink-0 items-center gap-2">
          <Switch
            id="wishlisted-only"
            checked={!!filters.wishlistedOnly}
            onCheckedChange={(checked) => onFilterChange({ wishlistedOnly: checked || undefined, page: 1 })}
            thumbIcon={<Icon name="saved" size="xs" filled={!!filters.wishlistedOnly} tone={filters.wishlistedOnly ? "primary" : "muted"} />}
          />
          {/* The switch is under the 40px floor, so the label is the rest of the target (ADR-0015). */}
          <label htmlFor="wishlisted-only" className="min-h-10 cursor-pointer select-none content-center text-small">
            {PRODUCT_CONSOLE_COPY.list.wishlistedOnly}
          </label>
        </div>
      </div>
    </div>
  );
}
