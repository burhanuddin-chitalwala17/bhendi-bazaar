import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { adminDashboardDAL } from "@/data-access-layer/admin/dashboard.dal";
import type { SalesPeriod } from "@server/analytics/sales.types";
import { attentionCopy } from "./attention-copy";

/**
 * "Needs action" (Q31): only what the admin can resolve now, each a link to the one place it is
 * resolved, money and buyers first. Empty is the all-clear, said plainly; a failed read says so
 * rather than looking like an all-clear.
 */
export async function NeedsActionBlock({ period, retryHref }: { period: SalesPeriod; retryHref: string }) {
  const { attention, readAt } = await adminDashboardDAL.forPeriod(period);
  const items = attention.ok ? attention.value.items : [];
  const now = new Date(readAt);

  return (
    <Card className="gap-0 p-0">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="text-title font-semibold text-foreground">Needs action</h2>
        {items.length > 0 && <span className="text-small tabular-nums text-muted-foreground">{items.length}</span>}
      </div>
      {!attention.ok ? (
        <ErrorState
          title="The queue didn't load"
          description="We couldn't check what is waiting. Nothing was changed."
          action={{ label: "Try again", href: retryHref }}
          className="px-4 py-6"
        />
      ) : items.length === 0 ? (
        <div className="flex items-center gap-3 px-4 py-6">
          <Icon name="success" size="md" tone="success" />
          <div>
            <p className="text-small font-medium text-foreground">All clear</p>
            <p className="text-caption text-muted-foreground">No refunds, pickups, payouts or courier updates are waiting.</p>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => {
            const copy = attentionCopy(item, now);
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  prefetch={false}
                  className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors duration-fast ease-standard hover:bg-muted/60"
                >
                  <Icon name={copy.icon} size="md" tone="muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-small font-medium text-foreground">{copy.title}</span>
                    <span className="block text-caption text-muted-foreground">{copy.detail}</span>
                  </span>
                  <Icon name="next" tone="muted" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
