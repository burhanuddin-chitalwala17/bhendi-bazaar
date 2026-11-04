/**
 * Admin Users Page — a server component ([ADR-0034]).
 *
 * The filters live in the URL, so the server can answer the question the URL asks. That is
 * what lets the list be rendered rather than fetched: the previous version was
 * `"use client"`, held filters in `useState`, and could only reach the database through
 * `GET /api/admin/users`. Two client leaves remain, for the two things that genuinely need
 * the browser — typing in the filter bar and blocking a user.
 */
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { adminUsersDAL } from "@/data-access-layer/admin/users.dal";
import { UsersFilters } from "@/components/profile/console/UsersFilters";
import { UsersTable } from "@/components/profile/console/UsersTable";
import { platformRoleSchema } from "@/lib/validation/schemas/common.schemas";
import {
  DEFAULT_PAGE_SIZE,
  resolvePageNumber,
  resolvePageSize,
  resolveSortBy,
  resolveSortOrder,
} from "@server/shared/pagination";

/** The columns this listing may be ordered by — the same set `UserListFilters` declares. */
const SORTABLE = ["createdAt", "lastActiveAt"] as const;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  // The query string is untrusted input like any other: every value is resolved against a
  // closed set rather than cast into one (Invariant 4).
  const isBlocked = one("isBlocked");
  const { users, total, totalPages } = await adminUsersDAL.list({
    search: one("search") || undefined,
    platformRole: platformRoleSchema.safeParse(one("platformRole")).data,
    isBlocked: isBlocked === "blocked" ? true : isBlocked === "active" ? false : undefined,
    page: resolvePageNumber(one("page")),
    limit: resolvePageSize(one("limit")),
    sortBy: resolveSortBy(one("sortBy"), SORTABLE, "createdAt"),
    sortOrder: resolveSortOrder(one("sortOrder")),
  });

  return (
    <PageShell width="wide">
      <PageHeader title="Users" description="Everyone with an account: buyers, shop members and admins." />

      <UsersFilters />

      <UsersTable
        users={users}
        page={resolvePageNumber(one("page"))}
        pageSize={resolvePageSize(one("limit"), DEFAULT_PAGE_SIZE)}
        totalPages={totalPages}
        total={total}
      />
    </PageShell>
  );
}
