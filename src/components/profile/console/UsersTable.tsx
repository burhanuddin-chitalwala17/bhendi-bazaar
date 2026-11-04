"use client";

import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

import { DataTable, Column } from "@/components/shared/data-table";
import { useMutation } from "@/hooks/core/useMutation";
import { adminUserApiClient } from "@/components/profile/console/adminUserApiClient";
import type { AdminUser } from "@/domain/admin";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { formatPhone } from "@server/shared/phone";
import { Button } from "@/components/ui/button";
import { PLATFORM_ROLE } from "@server/identity/admin.user.types";

interface Props {
  users: AdminUser[];
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
}

/**
 * The rows, and the one thing on this screen that is genuinely interactive: blocking a user.
 *
 * Paging and sorting navigate rather than refetch, because the page above is a server
 * component ([ADR-0034]) and the URL is where the query lives. `router.refresh()` after a
 * mutation re-runs that server read — no client cache to invalidate, and no second source of
 * truth for what the table is showing.
 */
export function UsersTable({ users, page, pageSize, totalPages, total }: Props) {
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

  const { mutate: toggleBlock, isLoading: isTogglingBlock } = useMutation(
    ({ id, isBlocked }: { id: string; isBlocked: boolean }) =>
      adminUserApiClient.toggleBlockUser(id, isBlocked),
    {
      successMessage: "User updated",
      onSuccess: () => router.refresh(),
    },
  );

  const columns: Column<AdminUser>[] = [
    {
      key: "name",
      label: "User",
      phone: "title",
      render: (user) => (
        <Link href={`/admin/users/${user.id}`} prefetch={false} className="block hover:underline">
          <span className="block font-medium">{user.name || "No name"}</span>
          <span className="block text-small font-normal text-muted-foreground">{user.email}</span>
          {user.mobile && (
            <span className="block text-small font-normal text-muted-foreground">{formatPhone(user.mobile)}</span>
          )}
        </Link>
      ),
    },
    {
      key: "platformRole",
      label: "Role",
      phone: "meta",
      render: (user) =>
        user.platformRole === PLATFORM_ROLE.ADMIN ? <StatusBadge tone="info">Admin</StatusBadge> : "Buyer",
    },
    { key: "ordersCount", label: "Orders", phone: "meta", render: (user) => `${user.ordersCount || 0} orders` },
    {
      key: "totalSpent",
      label: "Total spent",
      phone: "hidden",
      render: (user) => formatCurrency(user.totalSpent || 0),
    },
    {
      key: "createdAt",
      label: "Joined",
      sortable: true,
      phone: "hidden",
      render: (user) => formatShortDate(user.createdAt),
    },
    {
      key: "isBlocked",
      label: "Status",
      phone: "status",
      render: (user) => (
        <StatusBadge tone={user.isBlocked ? "destructive" : "success"} dot>
          {user.isBlocked ? "Blocked" : "Active"}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      phone: "trailing",
      render: (user) => (
        <Button
          variant="outline"
          size="sm"
          pending={isTogglingBlock}
          onClick={() => toggleBlock({ id: user.id, isBlocked: !user.isBlocked }).catch(() => {})}
          aria-label={`${user.isBlocked ? "Unblock" : "Block"} ${user.name || user.email}`}
        >
          {user.isBlocked ? "Unblock" : "Block"}
        </Button>
      ),
    },
  ];

  return (
    <DataTable
      data={users}
      label="Users"
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
