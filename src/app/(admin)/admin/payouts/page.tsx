/**
 * Platform payouts — what every organisation is owed.
 *
 * A server component: this is a read, and reading through a route handler would buy a
 * round trip and a loading spinner over data the server already had.
 */
import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { payoutsDAL } from "@/data-access-layer/payouts.dal";
import { formatCurrency } from "@/lib/format";
import { Card } from "@/components/ui/card";

export default async function AdminPayoutsPage() {
  await requirePlatformAdmin();
  const { orgs, unrecorded } = await payoutsDAL.overview();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Payouts</h1>
        <p className="text-sm text-muted-foreground">
          What each organisation has earned, and what is still owed.
        </p>
      </div>

      {/* Paid orders with no ledger entry. Always zero unless a write failed — a
          non-zero figure is money owed that nothing has recorded, so it leads. */}
      {unrecorded > 0 && (
        <Card className="border-warning/40 bg-warning/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="size-5 shrink-0 text-warning" aria-hidden />
            <div className="text-sm">
              <p className="font-medium">
                {unrecorded} paid {unrecorded === 1 ? "order has" : "orders have"} no ledger entry
              </p>
              <p className="text-muted-foreground">
                The nightly reconcile writes these automatically. If the figure persists, the
                entries are failing rather than lagging.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Single column on a phone; the two balances are never merged into one number. */}
      <ul className="grid gap-3 md:grid-cols-2">
        {orgs.map((org) => (
          <li key={org.id}>
            <Link
              href={`/admin/payouts/${org.id}`}
              className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-primary"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{org.name}</p>
                <p className="text-xs text-muted-foreground">
                  {org.code} · {org.commissionBps / 100}% commission · {org.entryCount} entries
                  {org.negativeMarginOrders > 0 && (
                    <span className="text-warning">
                      {" "}· {org.negativeMarginOrders} below cost
                    </span>
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold tabular-nums">{formatCurrency(org.owedPaise)}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {formatCurrency(org.unclaimedPaise)} unclaimed
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>

      {orgs.length === 0 && (
        <p className="text-sm text-muted-foreground">No organisations yet.</p>
      )}
    </div>
  );
}
