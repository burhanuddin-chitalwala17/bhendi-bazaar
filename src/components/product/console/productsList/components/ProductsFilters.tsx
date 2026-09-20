// components/admin/productsContainer/components/ProductsFilters.tsx
"use client";

import { useState } from "react";
import { Heart, Search } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { ProductFilters } from "../../types";
import type { ProductShelf } from "@server/catalog/product.visibility";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

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
            <Input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search by name, SKU..."
              disabled={isPending}
              className="flex-1 disabled:opacity-50"
            />
            <Button
              variant="default"
              onClick={handleSearch}
              disabled={isPending}
              className="flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              Search
            </Button>
          </div>
        </div>

        {/* Category Filter */}
        <Select
          value={filters.categoryId || ""}
          onChange={(e) =>
            onFilterChange({ categoryId: e.target.value || undefined, page: 1 })
          }
          disabled={isPending}
          className="disabled:opacity-50"
        >
          <option value="">All Categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>

        {/* Shelf filter — available, archived, or both (ADR-0029). Full width at base
            so it stacks on a phone rather than crowding the row. */}
        <Select
          value={filters.shelf || "available"}
          onChange={(e) =>
            onFilterChange({ shelf: e.target.value as ProductShelf, page: 1 })
          }
          disabled={isPending}
          aria-label="Filter by whether the product is archived"
          className="w-full disabled:opacity-50 sm:w-auto"
        >
          <option value="available">Available</option>
          <option value="archived">Archived</option>
          <option value="all">All</option>
        </Select>

        {/* Stock Filter */}
        <Select
          value={currentStockFilter}
          onChange={(e) => handleStockFilter(e.target.value)}
          disabled={isPending}
          className="disabled:opacity-50"
        >
          <option value="">All Stock</option>
          <option value="low">Low Stock</option>
          <option value="out">Out of Stock</option>
        </Select>

        {/* Wishlisted only. A filter, so it goes through onFilterChange like the
            others — the server picks the page, and paging stays honest. */}
        <div className="flex items-center gap-2">
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
          <label
            htmlFor="wishlisted-only"
            className="cursor-pointer select-none"
          >
            Wishlisted only
          </label>
        </div>
      </div>
    </div>
  );
}
