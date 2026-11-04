"use client";

import type { RefundRow } from "@server/checkout/refund-queue";
import { REFUND_STATE } from "@server/payments/refund.types";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ResourceList } from "@/components/shared/resource-list";
import { StatusBadge, type StatusTone } from "@/components/shared/badges/StatusBadge";
import { StartRefund } from "./start-refund";
import { REFUNDS_COPY, causeLabel, razorpayPaymentUrl } from "./refunds-copy";

/** Owed past 2 days reads amber (ux.md Stale). */
const STALE_DAYS = 2;

/** One word and one tone per state; the detail line says the rest. */
function chip(row: RefundRow): { label: string; tone: StatusTone } {
  if (row.state === REFUND_STATE.STARTED) return { label: "Started", tone: "success" };
  if (row.state === REFUND_STATE.UNCONFIRMED) return { label: "Unconfirmed", tone: "warning" };
  if (row.state === REFUND_STATE.FAILED) return { label: "Refused", tone: "destructive" };
  return { label: "Owed", tone: row.owedDays > STALE_DAYS ? "warning" : "neutral" };
}

/** When it started, what went wrong, or how long it has waited. */
function detail(row: RefundRow): string | null {
  if (row.state === REFUND_STATE.STARTED) return REFUNDS_COPY.startedLine(row.startedDay ?? "", row.gatewayRefundId ?? "");
  if (row.state === REFUND_STATE.UNCONFIRMED) return REFUNDS_COPY.unconfirmed;
  if (row.state === REFUND_STATE.FAILED) return REFUNDS_COPY.refused(row.failureReason ?? "");
  if (row.owedDays > STALE_DAYS) return REFUNDS_COPY.owedFor(row.owedDays);
  return null;
}

function Actions({ row }: { row: RefundRow }) {
  if (row.state === REFUND_STATE.STARTED) return null;
  const checkFirst = row.state === REFUND_STATE.UNCONFIRMED || row.state === REFUND_STATE.FAILED;
  return (
    <div className="flex flex-wrap gap-2 md:justify-end">
      {checkFirst && (
        <Button asChild size="sm" variant="outline">
          <a href={razorpayPaymentUrl(row.paymentId)} target="_blank" rel="noopener noreferrer">
            {REFUNDS_COPY.openRazorpay} <Icon name="external" size="xs" />
          </a>
        </Button>
      )}
      <StartRefund refundId={row.id} amountPaise={row.amountPaise} retry={checkFirst} />
    </div>
  );
}

/** ux.md "admin refunds": not started first, oldest first; then started. Rows on a phone, a table from `lg:`. */
export function RefundList({ rows }: { rows: RefundRow[] }) {
  return (
    <ResourceList
      label="Refunds"
      rows={rows}
      rowKey={(row) => row.id}
      rowHref={(row) => `/admin/orders/${row.orderId}`}
      tableFrom="lg"
      empty={{ title: REFUNDS_COPY.empty, description: "A refund appears here when a paid parcel is cancelled, lost, damaged or returned." }}
      columns={[
        { key: "refund", label: "Refund", cell: (row) => REFUNDS_COPY.owed(row.amountPaise), phone: "title" },
        { key: "parcel", label: "Parcel", cell: (row) => <span className="font-mono">{row.parcelCode}</span>, phone: "meta" },
        { key: "cause", label: "Why", cell: (row) => causeLabel(row.cause, row.cancelledBy), phone: "meta" },
        { key: "order", label: "Order", cell: (row) => <span className="font-mono">{row.orderCode}</span>, phone: "meta" },
        {
          key: "state",
          label: "Status",
          cell: (row) => {
            const c = chip(row);
            return <StatusBadge tone={c.tone} dot>{c.label}</StatusBadge>;
          },
          phone: "status",
        },
        {
          key: "detail",
          label: "Detail",
          cell: (row) => <span className="whitespace-normal text-caption text-muted-foreground">{detail(row) ?? "—"}</span>,
        },
        { key: "actions", label: "Action", cell: (row) => <Actions row={row} />, phone: "trailing", align: "end" },
      ]}
    />
  );
}
