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
import { PAYOUTS_PAGE_COPY } from "@/components/payouts/payouts-copy";
import { ROUTES } from "@server/shared/routes";

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
        back={{ href: ROUTES.admin.payouts, label: PAYOUTS_PAGE_COPY.back }}
        title={org.name}
        description={PAYOUTS_PAGE_COPY.orgDescription(org.code, org.commissionBps / 100)}
      />

      {/* Two figures because they differ and both matter (D7). */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-caption uppercase tracking-label text-muted-foreground">
            {PAYOUTS_PAGE_COPY.owed}
          </p>
          <p className="font-heading text-headline font-semibold tabular-nums">
            {formatCurrency(owedPaise)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-caption uppercase tracking-label text-muted-foreground">
            {PAYOUTS_PAGE_COPY.unclaimed}
          </p>
          <p className="font-heading text-headline font-semibold tabular-nums">
            {formatCurrency(unclaimedPaise)}
          </p>
          <p className="mt-1 text-caption text-muted-foreground">
            {PAYOUTS_PAGE_COPY.notInSettlement}
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
