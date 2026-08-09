/**
 * Admin Orders Page
 * List and manage orders with filters
 */

"use client";

import { useAsyncData } from "@/hooks/core/useAsyncData";
import { useMutation } from "@/hooks/core/useMutation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DataTable, Column } from "@/admin/data-table";
import { Search, Filter, RefreshCw } from "lucide-react";
import { adminOrderApiClient } from "@/services/admin/orderApiClient";
import type { Order } from "@/domain/order";
import type { OrderListFilters } from "@/domain/admin";
import { cn } from "@/lib/utils";
import { SectionHeader } from "@/components/shared/SectionHeader";

export default function AdminOrdersPage() {
  const [filters, setFilters] = useState<OrderListFilters>({
    page: 1,
    limit: 20,
  });
  const [searchTerm, setSearchTerm] = useState("");

  // Use new hooks for data fetching
  const {
    data,
    loading: isLoading,
    error,
    refetch,
  } = useAsyncData(() => adminOrderApiClient.getOrders(filters), {
    refetchDependencies: [filters],
  });

  // Use mutation for status updates
  const { mutate: updateStatus, isLoading: isUpdatingStatus } = useMutation(
    ({ orderId, status }: { orderId: string; status: string }) =>
      adminOrderApiClient.updateOrderStatus(orderId, { status }),
    {
      successMessage: "Order status updated!",
      onSuccess: () => refetch(),
    }
  );

  // Extract data with fallbacks
  const orders = data?.orders || [];
  const totalPages = data?.totalPages || 1;

  const handleSearch = () => {
    setFilters({ ...filters, search: searchTerm, page: 1 });
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    await updateStatus({ orderId, status: newStatus });
  };

  const handleRefresh = () => {
    toast.info("Refreshing orders...");
    refetch().then(() => toast.success("Orders refreshed!"));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const columns: Column<Order>[] = [
    {
      key: "code",
      label: "Order Code",
      sortable: true,
      render: (order) => (
        <a
          href={`/admin/orders/${order.id}`}
          className="font-mono font-semibold text-primary hover:text-primary hover:underline"
        >
          {order.code}
        </a>
      ),
    },
    {
      key: "userName",
      label: "Customer",
      render: (order) => (
        <div>
          <p className="font-medium">{order.address?.fullName || "Guest"}</p>
          <p className="text-sm text-muted-foreground">{order.address?.email}</p>
        </div>
      ),
    },
    {
      key: "grandTotal",
      label: "Total",
      render: (order) => (
        <span className="font-semibold">
          {formatCurrency(order.grandTotal || 0)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (order) => (
        <select
          value={order.status}
          onChange={(e) => handleStatusChange(order.id, e.target.value)}
          disabled={isUpdatingStatus}
          className={cn(
            "px-3 py-1 rounded-full text-sm font-medium",
            order.status === "processing" && "bg-warning/15 text-warning",
            order.status === "packed" && "bg-info/15 text-info",
            order.status === "shipped" && "bg-accent/40 text-accent-foreground",
            order.status === "delivered" && "bg-success/15 text-success"
          )}
        >
          <option value="processing">Processing</option>
          <option value="packed">Packed</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
        </select>
      ),
    },
    {
      key: "paymentStatus",
      label: "Payment",
      render: (order) => (
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            order.paymentStatus === "paid"
              ? "bg-success/15 text-success"
              : order.paymentStatus === "failed"
              ? "bg-destructive/15 text-destructive"
              : "bg-warning/15 text-warning"
          }`}
        >
          {order.paymentStatus || "pending"}
        </span>
      ),
    },
    {
      key: "createdAt",
      label: "Date",
      sortable: true,
      render: (order) => new Date(order.createdAt).toLocaleDateString(),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <SectionHeader overline="Orders" title="Orders" />
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

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
                placeholder="Search by order code, customer..."
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
            value={filters.status || ""}
            onChange={(e) =>
              setFilters({
                ...filters,
                status: e.target.value || undefined,
                page: 1,
              })
            }
            className="px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Statuses</option>
            <option value="pending_payment">Pending Payment</option>
            <option value="confirmed">Confirmed</option>
            <option value="processing">Processing</option>
            <option value="packed">Packed</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="partially_fulfilled">Partially Fulfilled</option>
            <option value="fulfillment_failed">Fulfillment Failed</option>
          </select>

          <select
            value={filters.paymentStatus || ""}
            onChange={(e) =>
              setFilters({
                ...filters,
                paymentStatus: e.target.value || undefined,
                page: 1,
              })
            }
            className="px-4 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Payments</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <DataTable
        data={orders as unknown as Order[]}
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


