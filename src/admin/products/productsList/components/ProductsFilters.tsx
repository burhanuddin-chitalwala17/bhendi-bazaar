// components/admin/productsContainer/components/ProductsFilters.tsx
"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import type { ProductFilters } from "../../types";

interface ProductsFiltersProps {
  filters: ProductFilters;
  onFilterChange: (filters: Partial<ProductFilters>) => void;
  isPending: boolean;
}

export function ProductsFilters({
  filters,
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
        <div className="flex-1 min-w-64">
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
      </div>
    </div>
  );
}