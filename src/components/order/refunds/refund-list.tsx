import { ExternalLink } from "lucide-react";

import type { RefundRow } from "@server/checkout/refund-queue";
import { REFUND_STATE } from "@server/payments/refund.types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StartRefund } from "./start-refund";
import { REFUNDS_COPY, causeLabel, razorpayPaymentUrl } from "./refunds-copy";

/** Owed past 2 days reads amber (ux.md Stale). */
const STALE_DAYS = 2;

function headline(row: RefundRow): string {
  return [REFUNDS_COPY.owed(row.amountPaise), row.parcelCode, causeLabel(row.cause, row.cancelledBy)].join(" · ");
}

/** The row's second line: when it started, or what went wrong, or how long it has waited. */
function Status({ row }: { row: RefundRow }) {
  if (row.state === REFUND_STATE.STARTED) {
    return <p className="text-muted-foreground">{REFUNDS_COPY.startedLine(row.startedDay ?? "", row.gatewayRefundId ?? "")}</p>;
  }
  if (row.state === REFUND_STATE.UNCONFIRMED) return <p role="status" className="text-warning">{REFUNDS_COPY.unconfirmed}</p>;
  if (row.state === REFUND_STATE.FAILED) {
    return <p role="status" className="text-destructive">{REFUNDS_COPY.refused(row.failureReason ?? "")}</p>;
  }
  if (row.owedDays > STALE_DAYS) return <p className="font-medium text-warning">{REFUNDS_COPY.owedFor(row.owedDays)}</p>;
  return null;
}

function Actions({ row }: { row: RefundRow }) {
  if (row.state === REFUND_STATE.STARTED) return null;
  const checkFirst = row.state === REFUND_STATE.UNCONFIRMED || row.state === REFUND_STATE.FAILED;
  return (
    <div className="flex flex-wrap gap-2 lg:justify-end">
      {checkFirst && (
        <Button asChild size="sm" variant="outline" className="min-h-10">
          <a href={razorpayPaymentUrl(row.paymentId)} target="_blank" rel="noopener noreferrer">
            {REFUNDS_COPY.openRazorpay} <ExternalLink className="ml-1 size-3" />
          </a>
        </Button>
      )}
      <StartRefund refundId={row.id} amountPaise={row.amountPaise} retry={checkFirst} />
    </div>
  );
}

/** ux.md "admin refunds": not started first, oldest first; then started. Cards on phone, a table at `lg:`. */
export function RefundList({ rows }: { rows: RefundRow[] }) {
  const tone = (row: RefundRow) =>
    cn(row.state === REFUND_STATE.STARTED && "opacity-70", row.state !== REFUND_STATE.STARTED && row.owedDays > STALE_DAYS && "border-warning");
  return (
    <>
      <ul className="grid grid-cols-1 gap-3 lg:hidden">
        {rows.map((row) => (
          <li key={row.id} className={cn("flex flex-col gap-2 rounded-card border bg-card p-4 text-sm", tone(row))}>
            <p className="break-words font-medium">{headline(row)}</p>
            <p className="text-muted-foreground">{row.orderCode}</p>
            <Status row={row} />
            <Actions row={row} />
          </li>
        ))}
      </ul>
      <table className="hidden w-full text-sm lg:table">
        <thead className="text-left text-muted-foreground">
          <tr>
            <th className="py-2">Refund</th>
            <th className="py-2">Order</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.id} className={tone(row)}>
              <td className="max-w-md break-words py-2 align-top">
                <p className="font-medium">{headline(row)}</p>
                <Status row={row} />
              </td>
              <td className="py-2 align-top">{row.orderCode}</td>
              <td className="py-2 text-right align-top">
                <Actions row={row} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
