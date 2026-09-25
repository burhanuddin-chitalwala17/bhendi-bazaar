// components/admin/productsContainer/components/ProductsTable.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { Eye, Heart } from "lucide-react";
import { DataTable, Column } from "@/components/shared/data-table";
import { PriceDisplay } from "@/components/shared/PriceDisplay";
import { StockBadge } from "@/components/shared/badges/StatusBadge";
import { ProductFlag } from "@/types/product";
import { ProductForTable } from "../../types";
import { ProductRowMenu } from "./ProductRowMenu";
import { Pagination } from "@/types/shared";
import { useProductsBasePath } from "@/components/product/console/useProductsBasePath";

interface ProductsTableProps {
  products: ProductForTable[];
  pagination: Pagination;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onDelete: (id: string, name: string) => void;
  /** Archive a product, or restore it (ADR-0029). */
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
  onPageSizeChange,
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
          <Image
            src={product.thumbnail}
            alt={product.name}
            // An archived product is dimmed rather than hidden: the org asked to see
            // it, and the state has to be legible at a glance on a phone.
            className={`w-12 h-12 object-cover rounded${product.archivedAt ? " opacity-50" : ""}`}
            width={48}
            height={48}
            sizes="48px"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p
                className={`font-medium${product.archivedAt ? " text-muted-foreground" : ""}`}
              >
                {product.name}
              </p>
              {product.archivedAt && (
                <span className="px-2 py-1 bg-muted text-muted-foreground text-xs rounded">
                  Archived
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {product.category.name}
            </p>
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
          <span
            className="text-muted-foreground"
            title="Nobody has saved this yet"
          >
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
      // The platform list is read-only, so it keeps the one action it has inline.
      render: (product) =>
        readOnly ? (
          <Link
            prefetch={false}
            href={`${productsBasePath}/${product.id}`}
            className="inline-flex size-10 items-center justify-center text-muted-foreground hover:bg-muted/60 rounded-lg transition-colors"
            title="View product"
          >
            <Eye className="w-4 h-4" />
          </Link>
        ) : (
          <ProductRowMenu
            product={product}
            productsBasePath={productsBasePath}
            onSetArchived={onSetArchived}
            onDelete={onDelete}
            disabled={isPending}
          />
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
      pageSize={pagination.limit}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      onSort={onSort}
      isLoading={isPending}
    />
  );
}
