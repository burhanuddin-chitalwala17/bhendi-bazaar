"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/admin/data-table";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { formatCurrency } from "@/lib/format";
import type { OrgOrderView } from "@/data-access-layer/org/orders.dal";

const PAYMENT_BADGE = { paid: "paid", pending: "pending", failed: "failed" } as const;

/**
 * The same DataTable the admin panel lists with, pointed at the org's projection.
 * Pagination navigates (the org lives in the URL), so the server component refetches.
 */
export function OrgOrdersTable({
  orders,
  pagination,
  orgId,
}: {
  orders: OrgOrderView[];
  pagination: { page: number; totalPages: number; total: number };
  orgId: string;
}) {
  const router = useRouter();

  const columns: Column<OrgOrderView>[] = [
    {
      key: "code",
      label: "Order",
      render: (order) => (
        <Link
          href={`/org/${orgId}/orders/${order.id}`}
          className="font-medium text-primary hover:underline"
        >
          {order.code}
        </Link>
      ),
    },
    {
      key: "createdAt",
      label: "Placed",
      render: (order) => new Date(order.createdAt).toLocaleDateString("en-IN"),
    },
    { key: "itemCount", label: "Items" },
    {
      key: "parcelValue",
      label: "Your parcel value",
      render: (order) => formatCurrency(order.parcelValue),
    },
    {
      key: "paymentStatus",
      label: "Payment",
      render: (order) => (
        <StatusBadge
          status={PAYMENT_BADGE[order.paymentStatus as keyof typeof PAYMENT_BADGE] ?? "default"}
        >
          {order.paymentStatus}
        </StatusBadge>
      ),
    },
    {
      key: "address",
      label: "Ships to",
      render: (order) => (
        <span className="text-muted-foreground">
          {order.address.city}, {order.address.pincode}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      data={orders}
      columns={columns}
      currentPage={pagination.page}
      totalPages={pagination.totalPages}
      totalItems={pagination.total}
      onPageChange={(page) => router.push(`/org/${orgId}/orders?page=${page}`)}
    />
  );
}
