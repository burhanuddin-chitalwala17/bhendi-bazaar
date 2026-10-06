"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Edit, MoveDown, MoveUp, Trash2 } from "lucide-react";

import { DataTable, Column } from "@/components/shared/data-table";
import { useMutation } from "@/hooks/core/useMutation";
import { adminCategoryApiClient } from "@/components/category/console/categoryApiClient";
import type { AdminCategory } from "@/domain/admin";
import { CATEGORY_ACCENTS } from "@/lib/category-accent";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Props {
  categories: AdminCategory[];
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
}

/**
 * The rows, and the three things that need a browser: reordering, deleting, and confirming the
 * delete. Paging and sorting navigate, because the page above is a server component
 * ([ADR-0034]) and the URL holds the query.
 */
export function CategoriesTable({ categories, page, pageSize, totalPages, total }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const go = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.push(`${pathname}?${next.toString()}`);
  };

  const { mutate: deleteCategory, isLoading: isDeleting } = useMutation(
    adminCategoryApiClient.deleteCategory,
    { successMessage: "Category deleted successfully!", onSuccess: () => router.refresh() },
  );

  const { mutate: reorder, isLoading: isUpdating } = useMutation(
    ({ id, order }: { id: string; order: number }) =>
      adminCategoryApiClient.updateCategory(id, { order }),
    { successMessage: "Category reordered successfully!", onSuccess: () => router.refresh() },
  );

  const confirmDelete = (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This will also affect products in this category.`)) {
      return;
    }
    // `useMutation` toasts both outcomes and rethrows; catching keeps a failed delete from also
    // becoming an unhandled rejection.
    void deleteCategory(id).catch(() => {});
  };

  const columns: Column<AdminCategory>[] = [
    {
      key: "order",
      label: "Order",
      sortable: true,
      render: (category) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-muted-foreground">{category.order}</span>
          <div className="flex flex-col gap-1">
            <Button
              variant="ghost"
              onClick={() => void reorder({ id: category.id, order: category.order - 1 }).catch(() => {})}
              disabled={category.order === 0 || isUpdating}
              className={cn("p-0.5 text-muted-foreground/70 hover:text-foreground", isUpdating && "cursor-not-allowed opacity-50")}
              title="Move up"
            >
              <MoveUp className="size-3" />
            </Button>
            <Button
              variant="ghost"
              onClick={() => void reorder({ id: category.id, order: category.order + 1 }).catch(() => {})}
              disabled={isUpdating}
              className={cn("p-0.5 text-muted-foreground/70 hover:text-foreground", isUpdating && "cursor-not-allowed opacity-50")}
              title="Move down"
            >
              <MoveDown className="size-3" />
            </Button>
          </div>
        </div>
      ),
    },
    {
      key: "name",
      label: "Category",
      sortable: true,
      render: (category) => (
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex size-12 items-center justify-center rounded-card border border-border",
              CATEGORY_ACCENTS[category.accent].swatch,
            )}
          >
            <span className="text-xs font-medium text-foreground/80">
              {category.name.substring(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium">{category.name}</p>
            <p className="text-sm text-muted-foreground">/{category.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: "description",
      label: "Description",
      render: (category) => (
        <p className="max-w-md truncate text-sm text-muted-foreground">{category.description}</p>
      ),
    },
    {
      key: "productsCount",
      label: "Products",
      render: (category) => (
        <span className="font-semibold text-foreground">{category.productsCount || 0}</span>
      ),
    },
    {
      key: "heroImage",
      label: "Hero Image",
      render: (category) => (
        <Image
          src={category.heroImage}
          alt={category.name}
          width={64}
          height={40}
          sizes="64px"
          className="h-10 w-16 rounded-field object-cover"
        />
      ),
    },
    {
      key: "createdAt",
      label: "Created",
      sortable: true,
      render: (category) => new Date(category.createdAt).toLocaleDateString(),
    },
    {
      key: "actions",
      label: "Actions",
      render: (category) => (
        <div className="flex items-center gap-2">
          <Link
            prefetch={false}
            href={`/admin/categories/${category.id}/edit`}
            className="rounded-field p-2 text-info transition-colors hover:bg-info/10"
            title="Edit category"
          >
            <Edit className="size-4" />
          </Link>
          <Button
            variant="ghost"
            onClick={() => confirmDelete(category.id, category.name)}
            disabled={isDeleting}
            className={cn(
              "rounded-field p-2 text-destructive transition-colors hover:bg-destructive/10",
              isDeleting && "cursor-not-allowed opacity-50",
            )}
            title="Delete category"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      data={categories}
      columns={columns}
      totalPages={totalPages}
      currentPage={page}
      totalItems={total}
      pageSize={pageSize}
      onPageChange={(next) => go({ page: String(next) })}
      onPageSizeChange={(limit) => go({ limit: String(limit), page: "" })}
      onSort={(key, order) => go({ sortBy: key, sortOrder: order })}
    />
  );
}
