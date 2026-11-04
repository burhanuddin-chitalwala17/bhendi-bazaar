"use client";

import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ListPagination, ResourceList, type ResourceColumn, type ResourceSelection } from "@/components/shared/resource-list";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { TeamEditBadge } from "@/components/product/team/team-edit-badge";
import { formatCount, formatCurrency } from "@/lib/format";
import type { Pagination } from "@/types/shared";
import type { ProductForTable } from "../../types";
import { ProductRowMenu } from "./ProductRowMenu";
import { useProductsBasePath } from "@/components/product/console/useProductsBasePath";
import { productStatus } from "./product-status";

interface ProductsTableProps {
  products: ProductForTable[];
  pagination: Pagination;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onDelete: (id: string, name: string) => void;
  /** Archive a product, or restore it (ADR-0029). */
  onSetArchived: (id: string, archived: boolean, name: string) => void;
  isPending: boolean;
  /** The platform's cross-vendor list is for looking, not touching — products belong to orgs. */
  readOnly?: boolean;
  /** Checkboxes for the bulk actions; absent on a read-only list. */
  selection?: ResourceSelection;
  /** What the empty list says, which depends on the filter it is showing. */
  empty: { title: string; description: string; action?: { label: string; href: string } };
}

/** The products list: a row per product on a phone, a dense table from a tablet (one component). */
export function ProductsTable({
  products,
  pagination,
  onPageChange,
  onPageSizeChange,
  onDelete,
  onSetArchived,
  isPending,
  readOnly = false,
  selection,
  empty,
}: ProductsTableProps) {
  const basePath = useProductsBasePath();

  const columns: ResourceColumn<ProductForTable>[] = [
    {
      key: "name",
      label: "Product",
      sortable: true,
      phone: "title",
      cell: (p) => (
        <span className={p.archivedAt ? "text-muted-foreground" : undefined}>{p.name}</span>
      ),
    },
    {
      key: "price",
      label: "Price",
      sortable: true,
      align: "end",
      phone: "meta",
      cell: (p) => (
        <span>
          {formatCurrency(p.salePrice ?? p.price)}
          {p.salePrice != null && p.salePrice < p.price && (
            <span className="ml-1 text-muted-foreground line-through">{formatCurrency(p.price)}</span>
          )}
        </span>
      ),
    },
    {
      key: "stock",
      label: "Stock",
      sortable: true,
      align: "end",
      phone: "meta",
      cell: (p) => (
        <span className={p.stock > 0 && p.stock <= p.lowStockThreshold ? "text-warning" : undefined}>
          {formatCount(p.stock)} in stock
        </span>
      ),
    },
    { key: "sku", label: "SKU", phone: "hidden", cell: (p) => <span className="font-mono">{p.sku || "—"}</span> },
    { key: "category", label: "Category", phone: "hidden", cell: (p) => p.category.name },
    {
      // Not sortable: the count is merged in after the page is selected, so sorting on it would
      // only reorder the rows already fetched — a ranking that lies.
      key: "wishlistCount",
      label: "Wishlisted",
      align: "end",
      phone: "hidden",
      cell: (p) =>
        p.wishlistCount > 0 ? (
          <span className="inline-flex items-center gap-1" title={`Saved by ${p.wishlistCount} ${p.wishlistCount === 1 ? "buyer" : "buyers"}`}>
            <Icon name="saved" size="xs" tone="muted" />
            {formatCount(p.wishlistCount)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "status",
      label: "Status",
      phone: "status",
      cell: (p) => {
        const status = productStatus(p);
        return (
          <span className="flex flex-col items-end gap-1 md:items-start">
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
            {p.teamEditedAt && <span className="hidden md:block"><TeamEditBadge at={p.teamEditedAt} /></span>}
          </span>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      phone: "trailing",
      cell: (p) =>
        readOnly ? (
          <Button asChild variant="ghost" shape="icon">
            <Link prefetch={false} href={`${basePath}/${p.id}`} aria-label={`View ${p.name}`}>
              <Icon name="show" size="sm" />
            </Link>
          </Button>
        ) : (
          <ProductRowMenu product={p} productsBasePath={basePath} onSetArchived={onSetArchived} onDelete={onDelete} disabled={isPending} />
        ),
    },
  ];

  return (
    <ResourceList
      label="Products"
      rows={products}
      rowKey={(p) => p.id}
      rowLabel={(p) => p.name}
      columns={columns}
      rowHref={(p) => `${basePath}/${p.id}`}
      selection={readOnly ? undefined : selection}
      state={isPending ? "loading" : "ready"}
      sortParams={{ by: "sort", order: "order" }}
      empty={empty}
      thumbnail={(p) => (
        <Image
          src={p.thumbnail}
          alt=""
          width={48}
          height={48}
          sizes="48px"
          className={p.archivedAt ? "size-12 rounded-field object-cover opacity-50" : "size-12 rounded-field object-cover"}
        />
      )}
      footer={
        <ListPagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          shown={products.length}
          pageSize={pagination.limit}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      }
    />
  );
}
