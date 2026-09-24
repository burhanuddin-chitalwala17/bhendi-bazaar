/**
 * Admin Categories — a server component ([ADR-0034]).
 *
 * The search lives in the URL so the server can answer it. Client leaves: the search box, and
 * the table with its reorder and delete controls.
 */
import Link from "next/link";
import { Plus, Upload } from "lucide-react";

import { PageHeader } from "@/components/shared/page-shell";
import { adminCategoriesDAL } from "@/data-access-layer/admin/categories.dal";
import { CategoriesFilters } from "@/components/category/console/CategoriesFilters";
import { CategoriesTable } from "@/components/category/console/CategoriesTable";
import {
  DEFAULT_PAGE_SIZE,
  resolvePageNumber,
  resolvePageSize,
  resolveSortBy,
  resolveSortOrder,
} from "@server/shared/pagination";

/** The columns this listing may be ordered by — the same set `CategoryListFilters` declares. */
const SORTABLE = ["order", "name", "createdAt"] as const;

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const page = resolvePageNumber(one("page"));
  const limit = resolvePageSize(one("limit"), DEFAULT_PAGE_SIZE);

  const { categories, total, totalPages } = await adminCategoriesDAL.list({
    search: one("search") || undefined,
    page,
    limit,
    sortBy: resolveSortBy(one("sortBy"), SORTABLE, "order"),
    sortOrder: resolveSortOrder(one("sortOrder"), "asc"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="Manage product categories and organization"
        actions={
          <>
            <Link
              prefetch={false}
              href="/admin/categories/bulk"
              className="flex items-center gap-2 rounded-field border border-border px-4 py-2 hover:bg-muted"
            >
              <Upload className="size-4" />
              <span className="hidden sm:inline">Bulk upload</span>
            </Link>
            <Link
              prefetch={false}
              href="/admin/categories/new"
              className="flex items-center gap-2 rounded-field bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="size-4" />
              Add Category
            </Link>
          </>
        }
      />

      <div className="rounded-card border border-border bg-card p-4">
        <CategoriesFilters />
      </div>

      <CategoriesTable
        categories={categories}
        page={page}
        pageSize={limit}
        totalPages={totalPages}
        total={total}
      />
    </div>
  );
}
