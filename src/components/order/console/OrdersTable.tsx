"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

import { DataTable, Column } from "@/components/shared/data-table";
import type { AdminOrderRow } from "@server/checkout/admin.order.types";
import { cn } from "@/lib/utils";
import { formatShortDate, titleCase } from "@/lib/format";
import { ORDER_STATUS, PAYMENT_STATUS } from "@server/checkout/order.types";
import { Money } from "@/components/shared/Money";

interface Props {
  orders: AdminOrderRow[];
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
}

/**
 * The rows. The status is read-only: it summarises the parcels (order-fulfilment D4, Q30), which
 * move from the pickup queue and the order's own screen.
 *
 * Paging and sorting navigate rather than refetch — the page above is a server component
 * ([ADR-0034]) and the URL is where the query lives.
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
      render: (order) => (
        <span
          className={cn(
            "rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground",
            order.status === ORDER_STATUS.SHIPPED && "bg-accent/40 text-accent-foreground",
            order.status === ORDER_STATUS.DELIVERED && "bg-success/15 text-success",
          )}
        >
          {titleCase(order.status)}
        </span>
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
