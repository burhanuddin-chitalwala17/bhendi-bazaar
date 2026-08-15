/**
 * One organisation's ledger.
 *
 * Each entry reads buyer paid → payable → commission → campaign cost, in that order,
 * so the last line explains the gap between the first two rather than needing a
 * caption (org-payouts UI approach).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { payoutsDAL } from "@/data-access-layer/payouts.dal";
import { formatCurrency } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { CommercialTerms } from "@/components/payouts/CommercialTerms";
import { SettleEntries } from "@/components/payouts/SettleEntries";
import { SettlementList } from "@/components/payouts/SettlementList";

export default async function AdminOrgPayoutPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  await requirePlatformAdmin();
  const { orgId } = await params;
  const { org, entries, unclaimedPaise, owedPaise, settlements, categoryRules, categories } =
    await payoutsDAL.forOrg(orgId);
  if (!org) notFound();

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/payouts" className="text-xs text-muted-foreground hover:underline">
          ← All payouts
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">{org.name}</h1>
        <p className="text-sm text-muted-foreground">
          {org.code} · default commission {org.commissionBps / 100}%
        </p>
      </div>

      {/* Two figures because they differ and both matter (D7). */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Owed</p>
          <p className="text-xl font-semibold tabular-nums">{formatCurrency(owedPaise)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Unclaimed</p>
          <p className="text-xl font-semibold tabular-nums">{formatCurrency(unclaimedPaise)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Not yet in a settlement</p>
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
    </div>
  );
}
