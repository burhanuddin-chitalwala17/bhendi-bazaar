// components/admin/productsContainer/components/ProductsTable.tsx
"use client";

import Link from "next/link";
import { Edit, Eye, Trash2 } from "lucide-react";
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
  onEdit: (id: string) => void;
  onView: (id: string) => void;
  onSort: (sortBy: string, sortOrder: "asc" | "desc") => void;
  isPending: boolean;
}

export function ProductsTable({
  products,
  pagination,
  onPageChange,
  onDelete,
  onEdit,
  onView,
  onSort,
  isPending,
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
            className="w-12 h-12 object-cover rounded"
          />
          <div>
            <p className="font-medium">{product.name}</p>
            <p className="text-sm text-gray-500">{product.category.name}</p>
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
      key: "badges",
      label: "Badges",
      render: (product) => (
        <div className="flex flex-wrap gap-1">
          {product.flags?.includes(ProductFlag.FEATURED) && (
            <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
              Featured
            </span>
          )}
          {product.flags?.includes(ProductFlag.ON_OFFER) && (
            <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
              Offer
            </span>
          )}
          {product.flags.includes(ProductFlag.HERO) && (
            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
              Hero
            </span>
          )}
          {product.flags.includes(ProductFlag.NEW_ARRIVAL) && (
            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
              New
            </span>
          )}
          {product.flags.includes(ProductFlag.CLEARANCE_SALE) && (
            <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded">
              Clearance
            </span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (product) => (
        <div className="flex items-center gap-2">
          <Link
            href={`${productsBasePath}/${product.id}`}
            className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            title="View product"
          >
            <Eye className="w-4 h-4" />
          </Link>
          <Link
            href={`${productsBasePath}/${product.id}/edit`}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit product"
          >
            <Edit className="w-4 h-4" />
          </Link>
          <button
            onClick={() => onDelete(product.id, product.name)}
            disabled={isPending}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
            title="Delete product"
          >
            <Trash2 className="w-4 h-4" />
          </button>
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