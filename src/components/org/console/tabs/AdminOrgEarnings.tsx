import { payoutsDAL } from "@/data-access-layer/payouts.dal";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { SETTLEMENT_STATUS_BADGE } from "@/components/payouts/settlement-status";

interface Props {
  orgId: string;
}

export async function AdminOrgEarnings({ orgId }: Props) {
  const {
    owedPaise,
    unclaimedPaise,
    orders,
    defaultBps,
    categoryRates,
    settlements,
  } = await payoutsDAL.earningsFor(orgId);

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <p className="text-label uppercase tracking-label text-muted-foreground">
          Shop is owed
        </p>
        <p className="text-headline font-semibold tabular-nums">
          {formatCurrency(owedPaise)}
        </p>
        <p className="mt-1 text-small text-muted-foreground tabular-nums">
          {formatCurrency(unclaimedPaise)} not yet in a settlement
        </p>
      </Card>

      <section className="space-y-3">
        <h2 className="text-small font-semibold">Commission</h2>
        <Card className="p-4">
          <p className="text-small">
            Default rate:{" "}
            <span className="font-semibold">{(defaultBps / 100).toFixed(1)}%</span>
          </p>
          {categoryRates.length > 0 && (
            <ul className="mt-2 space-y-1 text-caption text-muted-foreground">
              {categoryRates.map((cr, i) => (
                <li key={i}>
                  {cr.category.name}: {(cr.rateBps / 100).toFixed(1)}%
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-small font-semibold">
          Orders ({orders.length})
        </h2>
        {orders.length === 0 && (
          <p className="text-small text-muted-foreground">No orders yet.</p>
        )}
        <div className="space-y-2">
          {orders.slice(0, 20).map((order) => (
            <Card key={order.id} className="flex items-center justify-between p-3 text-small">
              <div>
                <span className="text-caption text-muted-foreground">
                  {formatShortDate(order.createdAt)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-caption text-muted-foreground">
                  Commission: {formatCurrency(order.commissionPaise)}
                </span>
                <span className="font-semibold">{formatCurrency(order.payablePaise)}</span>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {settlements.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-small font-semibold">Settlements</h2>
          <div className="space-y-2">
            {settlements.map((s) => (
              <Card key={s.id} className="flex items-center justify-between p-3 text-small">
                <div>
                  <span className="text-caption text-muted-foreground">
                    {formatShortDate(s.createdAt)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge tone={SETTLEMENT_STATUS_BADGE[s.status].tone} dot>
                    {SETTLEMENT_STATUS_BADGE[s.status].label}
                  </StatusBadge>
                  <span className="font-semibold">{formatCurrency(s.amountPaise)}</span>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
