/**
 * One organisation's ledger.
 *
 * Each entry reads buyer paid → payable → commission → campaign cost, in that order,
 * so the last line explains the gap between the first two rather than needing a
 * caption (org-payouts UI approach).
 */
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { payoutsDAL } from "@/data-access-layer/payouts.dal";
import { formatCurrency } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { CommercialTerms } from "@/components/payouts/CommercialTerms";
import { SettleEntries } from "@/components/payouts/SettleEntries";
import { SettlementList } from "@/components/payouts/SettlementList";
import { PageHeader, PageShell } from "@/components/shared/page-shell";

export default async function AdminOrgPayoutPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  await requirePlatformAdmin();
  const { orgId } = await params;
  const {
    org,
    entries,
    unclaimedPaise,
    owedPaise,
    settlements,
    categoryRules,
    categories,
  } = await payoutsDAL.forOrg(orgId);
  if (!org) notFound();

  return (
    <PageShell width="wide">
      <PageHeader
        back={{ href: "/admin/payouts", label: "Payouts" }}
        title={org.name}
        description={`${org.code} · default commission ${org.commissionBps / 100}%`}
      />

      {/* Two figures because they differ and both matter (D7). */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-caption uppercase tracking-label text-muted-foreground">
            Owed
          </p>
          <p className="font-heading text-headline font-semibold tabular-nums">
            {formatCurrency(owedPaise)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-caption uppercase tracking-label text-muted-foreground">
            Unclaimed
          </p>
          <p className="font-heading text-headline font-semibold tabular-nums">
            {formatCurrency(unclaimedPaise)}
          </p>
          <p className="mt-1 text-caption text-muted-foreground">
            Not yet in a settlement
          </p>
        </Card>
      </div>

      <CommercialTerms
        orgId={org.id}
        commissionBps={org.commissionBps}
        maxDiscountBps={org.maxDiscountBps}
        categories={categories}
        current={categoryRules}
      />

      <SettleEntries orgId={org.id} entries={entries} />

      <SettlementList settlements={settlements} />
    </PageShell>
  );
}
