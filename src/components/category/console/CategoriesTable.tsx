"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

import { DataTable, Column } from "@/components/shared/data-table";
import { useMutation } from "@/hooks/core/useMutation";
import { adminCategoryApiClient } from "@/components/category/console/categoryApiClient";
import type { AdminCategory } from "@/domain/admin";
import { CATEGORY_ACCENTS } from "@/lib/category-accent";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { formatShortDate } from "@/lib/format";

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
    { successMessage: "Category deleted", onSuccess: () => router.refresh() },
  );

  const { mutate: reorder, isLoading: isUpdating } = useMutation(
    ({ id, order }: { id: string; order: number }) =>
      adminCategoryApiClient.updateCategory(id, { order }),
    { successMessage: "Order saved", onSuccess: () => router.refresh() },
  );

  const confirmDelete = (id: string, name: string) => {
    if (!confirm(`Delete \"${name}\"? Products in it lose this category.`)) {
      return;
    }
    // `useMutation` toasts both outcomes and rethrows; catching keeps a failed delete from also
    // becoming an unhandled rejection.
    void deleteCategory(id).catch(() => {});
  };

  const columns: Column<AdminCategory>[] = [
    {
      key: "name",
      label: "Category",
      sortable: true,
      phone: "title",
      render: (category) => (
        <Link href={`/admin/categories/${category.id}/edit`} prefetch={false} className="flex items-center gap-3 hover:underline">
          <span
            aria-hidden
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-field border border-border text-caption font-medium text-foreground/80",
              CATEGORY_ACCENTS[category.accent].swatch,
            )}
          >
            {category.name.substring(0, 2).toUpperCase()}
          </span>
          <span className="min-w-0">
            <span className="block font-medium">{category.name}</span>
            <span className="block text-small font-normal text-muted-foreground">/{category.slug}</span>
          </span>
        </Link>
      ),
    },
    {
      key: "order",
      label: "Order",
      sortable: true,
      phone: "hidden",
      render: (category) => (
        <div className="flex items-center gap-1">
          <span className="w-6 font-mono text-small tabular-nums text-muted-foreground">{category.order}</span>
          <Button
            variant="ghost"
            shape="icon"
            size="sm"
            onClick={() => void reorder({ id: category.id, order: category.order - 1 }).catch(() => {})}
            disabled={category.order === 0}
            pending={isUpdating}
            aria-label={`Move ${category.name} up`}
          >
            <Icon name="move-up" />
          </Button>
          <Button
            variant="ghost"
            shape="icon"
            size="sm"
            onClick={() => void reorder({ id: category.id, order: category.order + 1 }).catch(() => {})}
            pending={isUpdating}
            aria-label={`Move ${category.name} down`}
          >
            <Icon name="move-down" />
          </Button>
        </div>
      ),
    },
    {
      key: "description",
      label: "Description",
      phone: "hidden",
      render: (category) => (
        <p className="max-w-md truncate text-small text-muted-foreground">{category.description}</p>
      ),
    },
    {
      key: "productsCount",
      label: "Products",
      phone: "meta",
      render: (category) => `${category.productsCount || 0} products`,
    },
    {
      key: "heroImage",
      label: "Hero image",
      phone: "hidden",
      render: (category) => (
        <Image
          src={category.heroImage}
          alt=""
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
      phone: "hidden",
      render: (category) => formatShortDate(category.createdAt),
    },
    {
      key: "actions",
      label: "Actions",
      phone: "trailing",
      render: (category) => (
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="hidden md:inline-flex">
            <Link prefetch={false} href={`/admin/categories/${category.id}/edit`} aria-label={`Edit ${category.name}`}>
              <Icon name="edit" />
              Edit
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => confirmDelete(category.id, category.name)}
            pending={isDeleting}
            aria-label={`Delete ${category.name}`}
          >
            <Icon name="delete" />
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <DataTable
      data={categories}
      label="Categories"
      columns={columns}
      totalPages={totalPages}
      currentPage={page}
      totalItems={total}
      pageSize={pageSize}
      onPageChange={(next) => go({ page: String(next) })}
      onPageSizeChange={(limit) => go({ limit: String(limit), page: "" })}
    />
  );
}
