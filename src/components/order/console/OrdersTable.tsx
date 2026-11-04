"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ROUTES } from "@server/shared/routes";

import { ListPagination, ResourceList, type ResourceColumn } from "@/components/shared/resource-list";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { Money } from "@/components/shared/Money";
import { formatShortDate } from "@/lib/format";
import type { AdminOrderRow } from "@server/checkout/admin.order.types";
import { orderChip, paymentChip } from "./order-status";
import { ORDERS_TABLE_COPY } from "./console-copy";

interface Props {
  orders: AdminOrderRow[];
  /** The order open beside the list (`?order=`, Q36). */
  peekId?: string;
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
}

/** The order's columns, shared with the dashboard's latest orders so the two cannot disagree. */
const ORDER_COLUMNS: ResourceColumn<AdminOrderRow>[] = [
  { key: "code", label: ORDERS_TABLE_COPY.order, cell: (o) => <span className="font-mono">{o.code}</span>, phone: "title" },
  { key: "buyer", label: ORDERS_TABLE_COPY.buyer, cell: (o) => o.customerName || ORDERS_TABLE_COPY.guest, phone: "meta" },
  { key: "total", label: ORDERS_TABLE_COPY.total, cell: (o) => <Money paise={o.grandTotal || 0} />, sortable: true, align: "end", phone: "meta" },
  {
    key: "status",
    label: ORDERS_TABLE_COPY.status,
    cell: (o) => {
      const chip = orderChip(o.status);
      return <StatusBadge tone={chip.tone} dot>{chip.label}</StatusBadge>;
    },
    phone: "status",
  },
  {
    key: "payment",
    label: ORDERS_TABLE_COPY.payment,
    cell: (o) => {
      const chip = paymentChip(o.paymentStatus);
      return <StatusBadge tone={chip.tone}>{chip.label}</StatusBadge>;
    },
    phone: "hidden",
  },
  { key: "createdAt", label: ORDERS_TABLE_COPY.placed, cell: (o) => formatShortDate(o.createdAt), sortable: true, phone: "meta" },
];

/**
 * The rows. The status is read-only: it summarises the parcels (order-fulfilment D4, Q30), which
 * move from the pickup queue and the order's own screen. Paging navigates; the URL is the query.
 */
export function OrdersTable({ orders, peekId, page, pageSize, totalPages, total }: Props) {
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

  // From desktop a row opens beside the list, keeping the view; below it, the full page (Q36).
  const peekHref = (o: AdminOrderRow) => {
    const next = new URLSearchParams(params.toString());
    next.set("order", o.id);
    return `${pathname}?${next.toString()}`;
  };

  return (
    <ResourceList
      label={ORDERS_TABLE_COPY.orders}
      rows={orders}
      rowKey={(o) => o.id}
      rowHref={(o) => ROUTES.admin.order(o.id)}
      tableRowHref={peekHref}
      activeKey={peekId}
      tableFrom="lg"
      columns={ORDER_COLUMNS}
      empty={{ title: ORDERS_TABLE_COPY.noOrdersHere, description: ORDERS_TABLE_COPY.ordersMatchViewAppear }}
      footer={
        <ListPagination
          page={page}
          totalPages={totalPages}
          total={total}
          shown={orders.length}
          pageSize={pageSize}
          onPageChange={(next) => go({ page: String(next) })}
          onPageSizeChange={(limit) => go({ limit: String(limit), page: "" })}
        />
      }
    />
  );
}

/** The newest few, for the dashboard: the same columns, no paging, sort stays with the orders page. */
export function LatestOrdersList({ orders }: { orders: AdminOrderRow[] }) {
  return (
    <ResourceList
      label={ORDERS_TABLE_COPY.latestOrders}
      rows={orders}
      rowKey={(o) => o.id}
      rowHref={(o) => ROUTES.admin.order(o.id)}
      columns={ORDER_COLUMNS.map((c) => ({ ...c, sortable: false }))}
      tableFrom="lg"
      empty={{ title: ORDERS_TABLE_COPY.noOrdersYet, description: ORDERS_TABLE_COPY.newestOrdersAppearHere }}
    />
  );
}
