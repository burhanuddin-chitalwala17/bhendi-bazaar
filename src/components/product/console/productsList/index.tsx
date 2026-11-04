"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageTabs } from "@/components/shared/page-tabs";
import { SelectionBar } from "@/components/shared/selection-bar";
import { BULK_ACTION, type BulkAction } from "@server/catalog/product-bulk.types";
import { BulkActionDialog, type BulkLocation, type BulkMarketplace, type BulkTarget } from "../bulk/BulkActionDialog";
import { BULK_COPY } from "../bulk/bulk-copy";
import { ProductsFilters } from "./components/ProductsFilters";
import { ProductsTable } from "./components/ProductsTable";
import { productTabs, type ProductTabKey } from "./product-tabs";
import { useProducts } from "../useProducts";
import type { ProductStats, ProductFilters, ProductListResult } from "../types";
import { useProductsBasePath } from "@/components/product/console/useProductsBasePath";

interface ProductsContainerProps {
  readOnly?: boolean;
  initialData: ProductListResult;
  initialStats: ProductStats;
  initialFilters: ProductFilters;
  categories: Array<{ id: string; name: string }>;
  /** The shop's pickup addresses, for the bulk stock editor; without them Stock is not offered. */
  locations?: BulkLocation[];
  /** Marketplaces the shop is connected to, for "Send to marketplace". */
  marketplaces?: BulkMarketplace[];
  /** Where "Add a product" goes from an empty list; absent on the read-only views. */
  addHref?: string;
}

// Filter fields whose URL param is named differently — the pages read the short names.
const URL_PARAM_FOR: Partial<Record<keyof ProductFilters, string>> = {
  categoryId: "category",
  sortBy: "sort",
  sortOrder: "order",
  wishlistedOnly: "wishlisted",
};

/** The default shelf is available, so it stays out of the URL. */
const DEFAULT_SHELF = "available";

export function ProductsContainer({
  initialData,
  initialStats,
  initialFilters,
  categories,
  readOnly = false,
  locations,
  marketplaces = [],
  addHref,
}: ProductsContainerProps) {
  const productsBasePath = useProductsBasePath();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [bulk, setBulk] = useState<BulkAction | null>(null);
  // What the open action works on, held as picked: the result still names them once the selection clears.
  const [targets, setTargets] = useState<BulkTarget[]>([]);
  const [isPending, startTransition] = useTransition();
  // Optimistic state, adopted from the server on every navigation.
  const [data, setData] = useState(initialData);
  const [stats, setStats] = useState(initialStats);
  // Adopt new server data during render, not in an effect — no cascading render.
  const [syncedFrom, setSyncedFrom] = useState(initialData);
  if (initialData !== syncedFrom) {
    setSyncedFrom(initialData);
    setData(initialData);
    setStats(initialStats);
    // Another page or filter: what was picked is no longer on screen.
    if (!bulk) setSelected(new Set());
  }
  const { deleteProduct, setProductArchived } = useProducts({
    onSuccess: () => {
      router.refresh();
    },
  });
  // Filters live in the URL, so the server renders the page.
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
    if (Object.keys(newFilters).some((k) => k !== "page")) {
      params.set("page", "1");
    }
    startTransition(() => {
      router.push(`${productsBasePath}?${params.toString()}`);
    });
  };
  // Optimistic delete. The row leaves the list either way: a delete removes it, and
  // an archive takes it off the available shelf this list is showing.
  const handleDelete = async (id: string) => {
    setData((prev) => ({
      ...prev,
      products: prev.products.filter((p) => p.id !== id),
    }));
    setStats((prev) => ({ ...prev, totalProducts: prev.totalProducts - 1 }));
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
    setData((prev) => ({
      ...prev,
      products: stillBelongs
        ? prev.products.map((p) =>
            p.id === id
              ? { ...p, archivedAt: archived ? new Date() : null }
              : p,
          )
        : prev.products.filter((p) => p.id !== id),
    }));

    try {
      await setProductArchived(id, archived);
    } catch (error) {
      setData(initialData);
      setStats(initialStats);
      throw error;
    }
  };
  const tabs = productTabs(pathname, searchParams, stats);
  const current: ProductTabKey = initialFilters.shelf === "archived"
    ? "archived"
    : initialFilters.lowStock
      ? "low"
      : initialFilters.outOfStock
        ? "out"
        : "all";
  const picked = data.products.filter((p) => selected.has(p.id));
  const actions = [
    BULK_ACTION.PRICE,
    ...(locations ? [BULK_ACTION.STOCK] : []),
    BULK_ACTION.ARCHIVE,
    BULK_ACTION.SEND,
  ].map((action) => ({
    label: BULK_COPY.actionLabel[action],
    onClick: () => {
      setTargets(picked);
      setBulk(action);
    },
  }));

  return (
    <div className="space-y-4">
      <PageTabs tabs={tabs} current={current} label="Which products" />
      <ProductsFilters filters={initialFilters} categories={categories} onFilterChange={updateFilters} />
      <ProductsTable
        onSetArchived={handleSetArchived}
        products={data.products}
        pagination={data.pagination}
        onPageChange={(page) => updateFilters({ page })}
        onPageSizeChange={(limit) => updateFilters({ limit })}
        onDelete={handleDelete}
        readOnly={readOnly}
        isPending={isPending}
        selection={readOnly ? undefined : { selected, onChange: setSelected }}
        empty={
          current === "all" && !initialFilters.search && addHref
            ? { title: "No products yet", description: "Add your first product and it goes on sale in your shop.", action: { label: "Add a product", href: addHref } }
            : { title: "Nothing here", description: "No product matches this view. Try another tab or search." }
        }
      />
      {!readOnly && (
        <SelectionBar count={picked.length} noun="selected" actions={actions} onClear={() => setSelected(new Set())} />
      )}
      <BulkActionDialog
        action={bulk}
        onClose={() => setBulk(null)}
        products={targets}
        locations={locations ?? []}
        marketplaces={marketplaces}
        onDone={() => setSelected(new Set())}
      />
    </div>
  );
}
