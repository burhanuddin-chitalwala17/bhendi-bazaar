// components/admin/productsContainer/index.tsx

"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ProductsFilters } from "./components/ProductsFilters";
import { ProductsTable } from "./components/ProductsTable";
import { ProductsStats } from "./components/ProductsStats";
import { useProducts } from "../useProducts";
import type { ProductStats, ProductFilters, ProductListResult } from "../types";
import { useProductsBasePath } from "@/admin/products/useProductsBasePath";

interface ProductsContainerProps {
  readOnly?: boolean;
  initialData: ProductListResult;
  initialStats: ProductStats;
  initialFilters: ProductFilters;
  categories: Array<{ id: string; name: string }>;
}

// Filter fields whose URL param is named differently — the pages read the short names.
const URL_PARAM_FOR: Partial<Record<keyof ProductFilters, string>> = {
  categoryId: "category",
  sortBy: "sort",
  sortOrder: "order",
  wishlistedOnly: "wishlisted",
};

/** The default shelf is on-sale, so it stays out of the URL. */
const DEFAULT_SHELF = "on-sale";

export function ProductsContainer({
  initialData,
  initialStats,
  initialFilters,
  categories,
  readOnly = false,
}: ProductsContainerProps) {
  const productsBasePath = useProductsBasePath();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  
  // ✅ Optimistic state management
  const [data, setData] = useState(initialData);
  const [stats, setStats] = useState(initialStats);
  
  // Adopt new server data during render, not in an effect — no cascading render.
  const [syncedFrom, setSyncedFrom] = useState(initialData);
  if (initialData !== syncedFrom) {
    setSyncedFrom(initialData);
    setData(initialData);
    setStats(initialStats);
  }
  
  // ✅ Hook for mutations
  const { deleteProduct, setProductArchived } = useProducts({
    onSuccess: () => {
      router.refresh();
    }
  });
  
  // ⚡ Update URL for server-side filtering
  const updateFilters = (newFilters: Partial<ProductFilters>) => {
    const params = new URLSearchParams(searchParams.toString());
    
    Object.entries(newFilters).forEach(([key, value]) => {
      const param = URL_PARAM_FOR[key as keyof ProductFilters] ?? key;
      if (key === "shelf" && value === DEFAULT_SHELF) {
        params.delete(param);
      } else if (value) {
        params.set(param, String(value));
      } else {
        params.delete(param);
      }
    });
    
    // Reset to page 1 on filter change
    if (Object.keys(newFilters).some(k => k !== 'page')) {
      params.set('page', '1');
    }
    
    // ⚡ Trigger server re-render with transition
    startTransition(() => {
      router.push(`${productsBasePath}?${params.toString()}`);
    });
  };
  
  // ⚡ Optimistic delete. The row leaves the list either way: a delete removes it, and
  // an archive takes it off the on-sale shelf this list is showing.
  const handleDelete = async (id: string) => {
    // Optimistic UI update
    setData(prev => ({
      ...prev,
      products: prev.products.filter(p => p.id !== id),
    }));
    setStats(prev => ({ ...prev, totalProducts: prev.totalProducts - 1 }));
    
    try {
      await deleteProduct(id);
    } catch (error) {
      // Revert on error
      setData(initialData);
      setStats(initialStats);
      throw error;
    }
  };

  /**
   * Archive and restore, optimistically. The row is dropped rather than re-flagged
   * whenever it no longer belongs on the shelf being shown — which is every shelf but
   * `all`, where it stays and only its badge changes.
   */
  const handleSetArchived = async (id: string, archived: boolean) => {
    const shelf = initialFilters.shelf ?? DEFAULT_SHELF;
    const stillBelongs = shelf === "all";
    setData(prev => ({
      ...prev,
      products: stillBelongs
        ? prev.products.map(p =>
            p.id === id ? { ...p, archivedAt: archived ? new Date() : null } : p
          )
        : prev.products.filter(p => p.id !== id),
    }));

    try {
      await setProductArchived(id, archived);
    } catch (error) {
      setData(initialData);
      setStats(initialStats);
      throw error;
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <ProductsStats stats={stats} />
      
      {/* Filters */}
      <ProductsFilters
        filters={initialFilters}
        categories={categories}
        onFilterChange={updateFilters}
        isPending={isPending}
      />
      
      {/* Table */}
      <ProductsTable
        onSetArchived={handleSetArchived}
        products={data.products}
        pagination={data.pagination}
        onPageChange={(page) => updateFilters({ page })}
        onPageSizeChange={(limit) => updateFilters({ limit })}
        onSort={(sortBy: string, sortOrder: "asc" | "desc") => updateFilters({ sortBy: sortBy as "name"|"createdAt"|"price"|"stock", sortOrder })}
        onDelete={handleDelete}
        readOnly={readOnly}
        onEdit={(id: string) => router.push(`${productsBasePath}/${id}`)}
        onView={(id: string) => router.push(`${productsBasePath}/${id}`)}
        isPending={isPending}
      />
    </div>
  );
}