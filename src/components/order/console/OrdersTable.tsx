"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

import { DataTable, Column } from "@/components/shared/data-table";
import { useMutation } from "@/hooks/core/useMutation";
import { adminOrderApiClient } from "@/components/order/console/adminOrderApiClient";
import type { AdminOrderRow } from "@server/checkout/admin.order.types";
import { cn } from "@/lib/utils";
import { formatShortDate, titleCase } from "@/lib/format";
import { ORDER_STATUS, PAYMENT_STATUS } from "@server/checkout/order.types";
import { Select } from "@/components/ui/select";
import { Money } from "@/components/shared/Money";

/** The statuses an admin may set by hand — the fulfilment ones, not the payment lifecycle. */
const SETTABLE = [
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.PACKED,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.DELIVERED,
] as const;

interface Props {
  orders: AdminOrderRow[];
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
}

/**
 * The rows, and the one interactive thing on them: moving an order's fulfilment status.
 *
 * Paging and sorting navigate rather than refetch — the page above is a server component
 * ([ADR-0034]) and the URL is where the query lives. `router.refresh()` after a mutation re-runs
 * that read, so there is no client cache to invalidate.
 */
export function OrdersTable({ orders, page, pageSize, totalPages, total }: Props) {
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

  const { mutate: updateStatus, isLoading: isUpdating } = useMutation(
    ({ orderId, status }: { orderId: string; status: string }) =>
      adminOrderApiClient.updateOrderStatus(orderId, { status }),
    { successMessage: "Order status updated!", onSuccess: () => router.refresh() },
  );

  const columns: Column<AdminOrderRow>[] = [
    {
      key: "code",
      label: "Order Code",
      sortable: true,
      render: (order) => (
        <a
          href={`/admin/orders/${order.id}`}
          className="font-mono font-semibold text-primary hover:underline"
        >
          {order.code}
        </a>
      ),
    },
    {
      key: "userName",
      label: "Customer",
      render: (order) => <p className="font-medium">{order.customerName || "Guest"}</p>,
    },
    {
      key: "grandTotal",
      label: "Total",
      render: (order) => (
        <span className="font-semibold"><Money paise={order.grandTotal || 0} /></span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (order) =>
        // Every parcel was cancelled: the summary is final, so there is nothing to choose.
        order.status === ORDER_STATUS.CANCELLED ? (
          <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground">
            Cancelled
          </span>
        ) : (
        <Select
          value={order.status}
          onChange={(e) => updateStatus({ orderId: order.id, status: e.target.value })}
          disabled={isUpdating}
          className={cn(
            "rounded-full px-3 py-1 text-sm font-medium",
            order.status === ORDER_STATUS.PROCESSING && "bg-warning/15 text-warning",
            order.status === ORDER_STATUS.PACKED && "bg-info/15 text-info",
            order.status === ORDER_STATUS.SHIPPED && "bg-accent/40 text-accent-foreground",
            order.status === ORDER_STATUS.DELIVERED && "bg-success/15 text-success",
          )}
        >
          {SETTABLE.map((status) => (
            <option key={status} value={status}>{titleCase(status)}</option>
          ))}
        </Select>
        ),
    },
    {
      key: "paymentStatus",
      label: "Payment",
      render: (order) => (
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium",
            order.paymentStatus === PAYMENT_STATUS.PAID && "bg-success/15 text-success",
            order.paymentStatus === PAYMENT_STATUS.FAILED && "bg-destructive/15 text-destructive",
            order.paymentStatus !== PAYMENT_STATUS.PAID &&
              order.paymentStatus !== PAYMENT_STATUS.FAILED &&
              "bg-warning/15 text-warning",
          )}
        >
          {titleCase(order.paymentStatus || PAYMENT_STATUS.PENDING)}
        </span>
      ),
    },
    {
      key: "createdAt",
      label: "Date",
      sortable: true,
      render: (order) => formatShortDate(order.createdAt),
    },
  ];

  return (
    <DataTable
      data={orders}
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
