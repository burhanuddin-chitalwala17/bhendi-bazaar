"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { toast } from "sonner";

import { DataTable, Column } from "@/components/shared/data-table";
import { useMutation } from "@/hooks/core/useMutation";
import { adminUserApiClient } from "@/components/profile/console/adminUserApiClient";
import type { AdminUser } from "@/domain/admin";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { formatPhone } from "@server/shared/phone";
import { Button } from "@/components/ui/button";

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
      successMessage: "User status updated successfully!",
      onSuccess: () => router.refresh(),
    },
  );

  const columns: Column<AdminUser>[] = [
    {
      key: "name",
      label: "User",
      render: (user) => (
        <div>
          <p className="font-medium">{user.name || "N/A"}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          {user.mobile && (
            <p className="text-sm text-muted-foreground">{formatPhone(user.mobile)}</p>
          )}
        </div>
      ),
    },
    {
      key: "platformRole",
      label: "Role",
      render: (user) => (
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium",
            user.platformRole === "ADMIN"
              ? "bg-accent/40 text-accent-foreground"
              : "bg-muted text-foreground",
          )}
        >
          {user.platformRole}
        </span>
      ),
    },
    { key: "ordersCount", label: "Orders", render: (user) => user.ordersCount || 0 },
    {
      key: "totalSpent",
      label: "Total Spent",
      render: (user) => formatCurrency(user.totalSpent || 0),
    },
    {
      key: "createdAt",
      label: "Joined",
      sortable: true,
      render: (user) => new Date(user.createdAt).toLocaleDateString(),
    },
    {
      key: "isBlocked",
      label: "Status",
      render: (user) => (
        <Button
          variant="ghost"
          onClick={() =>
            toggleBlock({ id: user.id, isBlocked: !user.isBlocked }).then(() =>
              toast.success("User status updated successfully!"),
            )
          }
          disabled={isTogglingBlock}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium",
            user.isBlocked
              ? "bg-destructive/15 text-destructive hover:bg-destructive/25"
              : "bg-success/15 text-success hover:bg-success/25",
            isTogglingBlock && "cursor-not-allowed opacity-50",
          )}
        >
          {user.isBlocked ? "Blocked" : "Active"}
        </Button>
      ),
    },
  ];

  return (
    <DataTable
      data={users}
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
