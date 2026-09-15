// components/admin/productsContainer/components/ProductsFilters.tsx
"use client";

import { useState } from "react";
import { Heart, Search } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { ProductFilters } from "../../types";

interface ProductsFiltersProps {
  filters: ProductFilters;
  categories: Array<{ id: string; name: string }>;
  onFilterChange: (filters: Partial<ProductFilters>) => void;
  isPending: boolean;
}

export function ProductsFilters({
  filters,
  categories,
  onFilterChange,
  isPending,
}: ProductsFiltersProps) {
  const [searchTerm, setSearchTerm] = useState(filters.search || "");

  const handleSearch = () => {
    onFilterChange({ search: searchTerm, page: 1 });
  };

  const handleStockFilter = (value: string) => {
    onFilterChange({
      lowStock: value === "low" ? true : undefined,
      outOfStock: value === "out" ? true : undefined,
      page: 1,
    });
  };

  const currentStockFilter = filters.lowStock
    ? "low"
    : filters.outOfStock
    ? "out"
    : "";

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="flex flex-wrap gap-4">
        {/* Search */}
        <div className="w-full min-w-0 grow sm:w-auto sm:min-w-64">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search by name, SKU..."
              disabled={isPending}
              className="flex-1 px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <button
              onClick={handleSearch}
              disabled={isPending}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2 disabled:opacity-50"
            >
              <Search className="w-4 h-4" />
              Search
            </button>
          </div>
        </div>

        {/* Category Filter */}
        <select
          value={filters.categoryId || ""}
          onChange={(e) =>
            onFilterChange({ categoryId: e.target.value || undefined, page: 1 })
          }
          disabled={isPending}
          className="px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        >
          <option value="">All Categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        {/* Stock Filter */}
        <select
          value={currentStockFilter}
          onChange={(e) => handleStockFilter(e.target.value)}
          disabled={isPending}
          className="px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        >
          <option value="">All Stock</option>
          <option value="low">Low Stock</option>
          <option value="out">Out of Stock</option>
        </select>

        {/* Wishlisted only. A filter, so it goes through onFilterChange like the
            others — the server picks the page, and paging stays honest. */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-input">
          <Switch
            id="wishlisted-only"
            checked={!!filters.wishlistedOnly}
            disabled={isPending}
            onCheckedChange={(checked) =>
              onFilterChange({ wishlistedOnly: checked || undefined, page: 1 })
            }
            thumbIcon={
              <Heart
                className={`w-3 h-3 ${
                  filters.wishlistedOnly
                    ? "fill-current text-primary"
                    : "text-muted-foreground"
                }`}
              />
            }
          />
          {/* A 24px switch is under the 36px floor, so the label is the rest of the
              target — `button` is labelable, so clicking it toggles (ADR-0015). */}
          <label htmlFor="wishlisted-only" className="cursor-pointer select-none">
            Wishlisted only
          </label>
        </div>
      </div>
    </div>
  );
}