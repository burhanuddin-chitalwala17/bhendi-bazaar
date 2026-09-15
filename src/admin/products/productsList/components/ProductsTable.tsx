// components/admin/productsContainer/components/ProductsTable.tsx
"use client";

import Link from "next/link";
import { Archive, ArchiveRestore, Edit, Eye, Heart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, Column } from "@/admin/data-table";
import { PriceDisplay } from "@/components/shared/PriceDisplay";
import { StockBadge } from "@/components/shared/badges/StatusBadge";
import { ProductFlag } from "@/types/product";
import { ProductForTable } from "../../types";
import { Pagination } from "@/types/shared";
import { useProductsBasePath } from "@/admin/products/useProductsBasePath";

interface ProductsTableProps {
  products: ProductForTable[];
  pagination: Pagination;
  onPageChange: (page: number) => void;
  onDelete: (id: string, name: string) => void;
  /** Take a product off sale, or put it back (ADR-0026). */
  onSetArchived: (id: string, archived: boolean, name: string) => void;
  onEdit: (id: string) => void;
  onView: (id: string) => void;
  onSort: (sortBy: string, sortOrder: "asc" | "desc") => void;
  isPending: boolean;
  /** The platform's cross-vendor list is for looking, not touching — products belong to orgs. */
  readOnly?: boolean;
}

export function ProductsTable({
  products,
  pagination,
  onPageChange,
  onDelete,
  onSetArchived,
  onEdit,
  onView,
  onSort,
  isPending,
  readOnly = false,
}: ProductsTableProps) {
  const productsBasePath = useProductsBasePath();
  const columns: Column<ProductForTable>[] = [
    {
      key: "name",
      label: "Product",
      render: (product) => (
        <div className="flex items-center gap-3">
          <img
            src={product.thumbnail}
            alt={product.name}
            // A withdrawn product is dimmed rather than hidden: the org asked to see
            // it, and the state has to be legible at a glance on a phone.
            className={`w-12 h-12 object-cover rounded${product.archivedAt ? " opacity-50" : ""}`}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className={`font-medium${product.archivedAt ? " text-muted-foreground" : ""}`}>
                {product.name}
              </p>
              {product.archivedAt && (
                <span className="px-2 py-1 bg-muted text-muted-foreground text-xs rounded">
                  Withdrawn
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{product.category.name}</p>
          </div>
        </div>
      ),
    },
    {
      key: "sku",
      label: "SKU",
      render: (product) => (
        <span className="font-mono text-sm">{product.sku || "—"}</span>
      ),
    },
    {
      key: "price",
      label: "Price",
      sortable: true,
      render: (product) => (
        <PriceDisplay
          price={product.price}
          salePrice={product.salePrice}
          size="sm"
          showBadge={false}
        />
      ),
    },
    {
      key: "stock",
      label: "Stock",
      sortable: true,
      render: (product) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold">{product.stock}</span>
          <StockBadge
            stock={product.stock}
            threshold={product.lowStockThreshold}
          />
        </div>
      ),
    },
    {
      // Not sortable: the count is merged in after the page is selected, so sorting on
      // it would only reorder the ten rows already fetched — a ranking that lies.
      key: "wishlistCount",
      label: "Wishlisted",
      render: (product) =>
        product.wishlistCount > 0 ? (
          <span
            className="flex items-center gap-1.5 text-destructive"
            title={`Saved by ${product.wishlistCount} ${
              product.wishlistCount === 1 ? "user" : "users"
            }`}
          >
            <Heart className="w-4 h-4 fill-current" />
            <span className="font-semibold">{product.wishlistCount}</span>
          </span>
        ) : (
          <span className="text-muted-foreground" title="Nobody has saved this yet">
            —
          </span>
        ),
    },
    {
      key: "badges",
      label: "Badges",
      render: (product) => (
        <div className="flex flex-wrap gap-1">
          {product.flags?.includes(ProductFlag.FEATURED) && (
            <span className="px-2 py-1 bg-accent/40 text-accent-foreground text-xs rounded">
              Featured
            </span>
          )}
          {product.flags?.includes(ProductFlag.ON_OFFER) && (
            <span className="px-2 py-1 bg-destructive/15 text-destructive text-xs rounded">
              Offer
            </span>
          )}
          {product.flags.includes(ProductFlag.HERO) && (
            <span className="px-2 py-1 bg-info/15 text-info text-xs rounded">
              Hero
            </span>
          )}
          {product.flags.includes(ProductFlag.NEW_ARRIVAL) && (
            <span className="px-2 py-1 bg-success/15 text-success text-xs rounded">
              New
            </span>
          )}
          {product.flags.includes(ProductFlag.CLEARANCE_SALE) && (
            <span className="px-2 py-1 bg-warning/15 text-warning text-xs rounded">
              Clearance
            </span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      // Prefetch off: two links per row, so a listing puts ~20 admin page fetches in
      // view — each one an auth re-read plus the product tree, all of it discarded.
      render: (product) => (
        <div className="flex items-center gap-2">
          <Link
            prefetch={false}
            href={`${productsBasePath}/${product.id}`}
            className="p-2 text-muted-foreground hover:bg-muted/60 rounded-lg transition-colors"
            title="View product"
          >
            <Eye className="w-4 h-4" />
          </Link>
          {!readOnly && (
          <Link
            prefetch={false}
              href={`${productsBasePath}/${product.id}/edit`}
              className="p-2 text-info hover:bg-info/10 rounded-lg transition-colors"
              title="Edit product"
            >
              <Edit className="w-4 h-4" />
            </Link>
          )}
          {!readOnly && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onSetArchived(product.id, !product.archivedAt, product.name)}
              disabled={isPending}
              title={product.archivedAt ? "Put back on sale" : "Take off sale"}
            >
              {product.archivedAt ? (
                <ArchiveRestore className="w-4 h-4 text-success" />
              ) : (
                <Archive className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="sr-only">
                {product.archivedAt ? "Put back on sale" : "Take off sale"}
              </span>
            </Button>
          )}
          {!readOnly && (
            <button
              onClick={() => onDelete(product.id, product.name)}
              disabled={isPending}
              className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
              title="Delete product"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      data={products}
      columns={columns}
      totalPages={pagination.totalPages}
      currentPage={pagination.page}
      totalItems={pagination.total}
      onPageChange={onPageChange}
      onSort={onSort}
      isLoading={isPending}
    />
  );
}