/**
 * Admin Categories — a server component ([ADR-0034]).
 *
 * The search lives in the URL so the server can answer it. Client leaves: the search box, and
 * the table with its reorder and delete controls.
 */
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
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
    <PageShell width="wide">
      <PageHeader
        title="Categories"
        description="The categories buyers browse, in the order they see them."
        actions={
          <>
            <Button asChild variant="outline">
              <Link prefetch={false} href="/admin/categories/bulk">
                <Icon name="upload" />
                Bulk upload
              </Link>
            </Button>
            <Button asChild>
              <Link prefetch={false} href="/admin/categories/new">
                <Icon name="add" />
                Add category
              </Link>
            </Button>
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
    </PageShell>
  );
}
