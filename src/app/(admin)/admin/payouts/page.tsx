/**
 * Platform payouts — what every organisation is owed.
 *
 * A server component: this is a read, and reading through a route handler would buy a
 * round trip and a loading spinner over data the server already had.
 */
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { payoutsDAL } from "@/data-access-layer/payouts.dal";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { PayoutOrgList } from "@/components/payouts/payout-org-list";

export default async function AdminPayoutsPage() {
  await requirePlatformAdmin();
  const { orgs, unrecorded } = await payoutsDAL.overview();

  return (
    <PageShell width="wide">
      <PageHeader title="Payouts" description="What each shop has earned, and what is still owed." />

      {/* Paid orders with no ledger entry. Always zero unless a write failed — a
          non-zero figure is money owed that nothing has recorded, so it leads. */}
      {unrecorded > 0 && (
        <Card className="border-warning/40 bg-warning/5 p-4">
          <div className="flex items-start gap-3">
            <Icon name="warning" size="md" tone="warning" />
            <div className="text-small">
              <p className="font-medium">
                {unrecorded} paid{" "}
                {unrecorded === 1 ? "order has" : "orders have"} no ledger entry
              </p>
              <p className="text-muted-foreground">
                The nightly reconcile writes these automatically. If the figure
                persists, the entries are failing rather than lagging.
              </p>
            </div>
          </div>
        </Card>
      )}

      <PayoutOrgList orgs={orgs} />
    </PageShell>
  );
}
