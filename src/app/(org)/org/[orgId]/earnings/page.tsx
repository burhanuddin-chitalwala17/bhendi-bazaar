/**
 * What this organisation has earned.
 *
 * Read-only by construction (org-payouts D14): there is nothing to submit here, so
 * there are no controls to disable. A projection of the same rows the platform reads,
 * never a second calculation — the two reconcile to the paise.
 */
import { requireOrgMember } from "@/lib/org-auth";
import { payoutsDAL } from "@/data-access-layer/payouts.dal";
import { formatCurrency } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function OrgEarningsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  // Being authorised and being scoped are the same act — this id came from a
  // membership check that passed, never from the URL alone.
  const scope = await requireOrgMember(orgId);
  const { owedPaise, unclaimedPaise, orders, defaultBps, categoryRates, settlements } =
    await payoutsDAL.earningsFor(scope.orgId);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Earnings</h1>
        <p className="text-sm text-muted-foreground">What you have earned, and what is due.</p>
      </div>

      {/* Leads with the figure they came for. */}
      <Card className="p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">You are owed</p>
        <p className="text-3xl font-semibold tabular-nums">{formatCurrency(owedPaise)}</p>
        <p className="mt-1 text-sm text-muted-foreground tabular-nums">
          {formatCurrency(unclaimedPaise)} not yet in a settlement
        </p>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Orders</h2>
        {orders.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing yet — your first sale will appear here.</p>
        )}
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Card className="p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {order.orderId ?? "adjustment"}
                  </span>
                  {order.settlementStatus && (
                    <Badge variant="outline" className="text-[0.6875rem]">
                      {order.settlementStatus.toLowerCase()}
                    </Badge>
                  )}
                </div>

                {/* Reads down as a derivation: each line explains the next. */}
                <dl className="space-y-1.5 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Goods sold, at list</dt>
                    <dd className="tabular-nums">{formatCurrency(order.grossItemsPaise)}</dd>
                  </div>
                  {order.orgFundedDiscountPaise > 0 && (
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Your offer</dt>
                      <dd className="tabular-nums text-primary">
                        −{formatCurrency(order.orgFundedDiscountPaise)}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">
                      Commission
                      {order.rates.length > 0 && (
                        <span className="ml-1 text-xs">
                          ({[...new Set(order.rates.map((r) => `${r.rateBps / 100}%`))].join(" & ")})
                        </span>
                      )}
                    </dt>
                    <dd className="tabular-nums">−{formatCurrency(order.commissionPaise)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-border pt-2 text-base font-semibold">
                    <dt>You receive</dt>
                    <dd className="tabular-nums text-primary">{formatCurrency(order.payablePaise)}</dd>
                  </div>
                </dl>

                {/* Shown, not hidden (D13a). Without it, being credited on more than
                    buyers paid reads as an error rather than as the platform spending
                    to move this organisation's stock. */}
                {order.platformContributionPaise !== null && (
                  <p className="mt-3 border-t border-dashed border-border pt-3 text-xs text-muted-foreground">
                    Buyers paid {formatCurrency(order.buyerPaidPaise)} — the platform funded{" "}
                    {formatCurrency(order.platformContributionPaise)} of discount on your goods.
                    Your credit is unaffected.
                  </p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      </section>

      {settlements.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Payments to you</h2>
          <ul className="space-y-2">
            {settlements.map((settlement) => (
              <li
                key={settlement.code}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs">{settlement.code}</p>
                  <p className="text-xs text-muted-foreground">
                    {settlement.status === "PAID" && settlement.paidAt
                      ? `Paid ${settlement.paidAt.toLocaleDateString("en-IN")}`
                      : settlement.status.toLowerCase()}
                    {settlement.reference ? ` · ${settlement.reference}` : ""}
                  </p>
                </div>
                <span className="tabular-nums">{formatCurrency(settlement.amountPaise)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* A rate is checked occasionally and read once, so it sits at the foot. */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Your commission rates</h2>
        <div className="rounded-lg border border-border bg-card p-3 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Default</span>
            <span className="tabular-nums">{defaultBps / 100}%</span>
          </div>
          {categoryRates.map((rule) => (
            <div key={rule.category.name} className="mt-1.5 flex justify-between gap-4">
              <span className="text-muted-foreground">{rule.category.name}</span>
              <span className="tabular-nums">{rule.rateBps / 100}%</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
