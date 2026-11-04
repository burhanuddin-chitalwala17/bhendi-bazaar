"use client";

import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ROUTES } from "@server/shared/routes";

import { DataTable, Column } from "@/components/shared/data-table";
import { useMutation } from "@/hooks/core/useMutation";
import { adminUserApiClient } from "@/components/profile/console/adminUserApiClient";
import type { AdminUser } from "@/domain/admin";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { formatPhone } from "@server/shared/phone";
import { Button } from "@/components/ui/button";
import { PLATFORM_ROLE } from "@server/identity/admin.user.types";
import { USERS_TABLE_COPY } from "./console-copy";

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
      successMessage: USERS_TABLE_COPY.userUpdated,
      onSuccess: () => router.refresh(),
    },
  );

  const columns: Column<AdminUser>[] = [
    {
      key: "name",
      label: USERS_TABLE_COPY.user,
      phone: "title",
      render: (user) => (
        <Link href={ROUTES.admin.user(user.id)} prefetch={false} className="block hover:underline">
          <span className="block font-medium">{user.name || USERS_TABLE_COPY.noName}</span>
          <span className="block text-small font-normal text-muted-foreground">{user.email}</span>
          {user.mobile && (
            <span className="block text-small font-normal text-muted-foreground">{formatPhone(user.mobile)}</span>
          )}
        </Link>
      ),
    },
    {
      key: "platformRole",
      label: USERS_TABLE_COPY.role,
      phone: "meta",
      render: (user) =>
        user.platformRole === PLATFORM_ROLE.ADMIN ? <StatusBadge tone="info">{USERS_TABLE_COPY.admin}</StatusBadge> : USERS_TABLE_COPY.buyer,
    },
    { key: "ordersCount", label: USERS_TABLE_COPY.orders, phone: "meta", render: (user) => `${user.ordersCount || 0} orders` },
    {
      key: "totalSpent",
      label: USERS_TABLE_COPY.totalSpent,
      phone: "hidden",
      render: (user) => formatCurrency(user.totalSpent || 0),
    },
    {
      key: "createdAt",
      label: USERS_TABLE_COPY.joined,
      sortable: true,
      phone: "hidden",
      render: (user) => formatShortDate(user.createdAt),
    },
    {
      key: "isBlocked",
      label: USERS_TABLE_COPY.status,
      phone: "status",
      render: (user) => (
        <StatusBadge tone={user.isBlocked ? "destructive" : "success"} dot>
          {user.isBlocked ? USERS_TABLE_COPY.blocked : USERS_TABLE_COPY.active}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      label: USERS_TABLE_COPY.actions,
      phone: "trailing",
      render: (user) => (
        <Button
          variant="outline"
          size="sm"
          pending={isTogglingBlock}
          onClick={() => toggleBlock({ id: user.id, isBlocked: !user.isBlocked }).catch(() => {})}
          aria-label={`${user.isBlocked ? USERS_TABLE_COPY.unblock : USERS_TABLE_COPY.block} ${user.name || user.email}`}
        >
          {user.isBlocked ? USERS_TABLE_COPY.unblock : USERS_TABLE_COPY.block}
        </Button>
      ),
    },
  ];

  return (
    <DataTable
      data={users}
      label={USERS_TABLE_COPY.users}
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
