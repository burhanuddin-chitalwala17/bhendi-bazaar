/**
 * Admin Users Page
 * Manage users with filters and blocking
 */

"use client";

import { useAsyncData } from "@/hooks/core/useAsyncData";
import { useMutation } from "@/hooks/core/useMutation";
import { useState } from "react";
import { toast } from "sonner";
import { DataTable, Column } from "@/admin/data-table";
import { Search, RefreshCw } from "lucide-react";
import { adminUserApiClient } from "@/services/admin/userApiClient";
import type { AdminUser, UserListFilters } from "@/domain/admin";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { platformRoleSchema } from "@/lib/validation/schemas/common.schemas";

import { PageHeader } from "@/components/shared/page-shell";
export default function AdminUsersPage() {
  const [filters, setFilters] = useState<UserListFilters>({
    page: 1,
    limit: 20,
  });
  const [searchTerm, setSearchTerm] = useState("");

  const {
    data,
    loading: isLoading,
    error,
    refetch,
  } = useAsyncData(() => adminUserApiClient.getUsers(filters), {
    refetchDependencies: [filters],
  });
  const { users = [], totalPages = 1 } = data || {};

  const { mutate: toggleBlock, isLoading: isTogglingBlock } = useMutation(
    ({ id, isBlocked }: { id: string; isBlocked: boolean }) =>
      adminUserApiClient.toggleBlockUser(id, isBlocked),
    {
      successMessage: "User status updated successfully!",
      onSuccess: () => refetch(),
    }
  );
  const { mutate: updateUser, isLoading: updatingUser } = useMutation(
    ({
      id,
      data,
    }: {
      id: string;
      data: { name?: string; platformRole?: string; isBlocked?: boolean };
    }) => adminUserApiClient.updateUser(id, data),
    {
      successMessage: "User updated successfully!",
      onSuccess: () => refetch(),
    }
  );

  const handleRefresh = () => {
    toast.info("Refreshing users...");
    refetch().then(() => toast.success("Users refreshed successfully!"));
  };

  const handleSearch = () => {
    setFilters({ ...filters, search: searchTerm, page: 1 });
  };

  const handleToggleBlock = (userId: string, isBlocked: boolean) => {
    toggleBlock({ id: userId, isBlocked: !isBlocked }).then(() =>
      toast.success("User status updated successfully!")
    );
  };

  const columns: Column<AdminUser>[] = [
    {
      key: "name",
      label: "User",
      render: (user) => (
        <div>
          <p className="font-medium">{user.name || "N/A"}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          {user.mobile && (
            <p className="text-sm text-muted-foreground">{user.mobile}</p>
          )}
        </div>
      ),
    },
    {
      key: "platformRole",
      label: "Role",
      render: (user) => (
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            user.platformRole === "ADMIN"
              ? "bg-accent/40 text-accent-foreground"
              : "bg-muted text-foreground"
          }`}
        >
          {user.platformRole}
        </span>
      ),
    },
    {
      key: "ordersCount",
      label: "Orders",
      render: (user) => user.ordersCount || 0,
    },
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
        <button
          onClick={() => handleToggleBlock(user.id, user.isBlocked)}
          disabled={isTogglingBlock}
          className={cn(
            "px-3 py-1 rounded-full text-xs font-medium",
            user.isBlocked
              ? "bg-destructive/15 text-destructive hover:bg-destructive/25"
              : "bg-success/15 text-success hover:bg-success/25",
            isTogglingBlock && "opacity-50 cursor-not-allowed"
          )}
        >
          {user.isBlocked ? "Blocked" : "Active"}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage platform users"
        actions={
          <button
          onClick={handleRefresh}
          disabled={isLoading}
          className={cn(
            "flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all",
            isLoading && "opacity-50 cursor-not-allowed"
          )}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          {isLoading ? "Refreshing..." : "Refresh"}
          </button>
        }
      />

      {/* Filters */}
      <div className="bg-card rounded-lg border border-border p-4">
        <div className="flex flex-wrap gap-4">
          <div className="w-full min-w-0 grow sm:w-auto sm:min-w-64">
            <div className="flex gap-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search by name, email, mobile..."
                className="flex-1 px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                Search
              </button>
            </div>
          </div>

          <select
            value={filters.platformRole || ""}
            onChange={(e) =>
              setFilters({
                ...filters,
                platformRole: platformRoleSchema.safeParse(e.target.value).data,
                page: 1,
              })
            }
            className="px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Roles</option>
            <option value="USER">User</option>
            <option value="ADMIN">Admin</option>
          </select>

          <select
            value={
              filters.isBlocked === undefined
                ? ""
                : filters.isBlocked
                ? "blocked"
                : "active"
            }
            onChange={(e) =>
              setFilters({
                ...filters,
                isBlocked:
                  e.target.value === ""
                    ? undefined
                    : e.target.value === "blocked",
                page: 1,
              })
            }
            className="px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <DataTable
        data={users}
        columns={columns}
        totalPages={totalPages}
        currentPage={filters.page || 1}
        totalItems={data?.total || 0}
        onPageChange={(page) => setFilters({ ...filters, page })}
        onSort={(key, order) =>
          setFilters({ ...filters, sortBy: key as any, sortOrder: order })
        }
        isLoading={isLoading}
      />
    </div>
  );
}
