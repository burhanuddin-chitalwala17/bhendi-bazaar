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
};

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
  const { deleteProduct } = useProducts({
    onSuccess: () => {
      router.refresh();
    }
  });
  
  // ⚡ Update URL for server-side filtering
  const updateFilters = (newFilters: Partial<ProductFilters>) => {
    const params = new URLSearchParams(searchParams.toString());
    
    Object.entries(newFilters).forEach(([key, value]) => {
      const param = URL_PARAM_FOR[key as keyof ProductFilters] ?? key;
      if (value) {
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
  
  // ⚡ Optimistic delete
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
        products={data.products}
        pagination={data.pagination}
        onPageChange={(page) => updateFilters({ page })}
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