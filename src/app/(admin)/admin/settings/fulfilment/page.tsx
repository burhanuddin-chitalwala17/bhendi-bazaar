import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { fulfilmentSettingsDAL } from "@/data-access-layer/admin/fulfilment-settings.dal";
import { FeeForm } from "@/components/payouts/fulfilment-fee/fee-form";
import { CancelCountList } from "@/components/payouts/fulfilment-fee/cancel-count-list";
import { FEE_COPY } from "@/components/payouts/fulfilment-fee/fee-copy";
import { indiaDay } from "@server/shared/india-time";
import { PageHeader, PageShell } from "@/components/shared/page-shell";

export const metadata = { title: "Fulfilment settings", robots: { index: false, follow: false } };

async function Counts({ pages }: { pages: number }) {
  const { rows, total } = await fulfilmentSettingsDAL.counts(pages);
  return <CancelCountList rows={rows} total={total} nextHref={`/admin/settings/fulfilment?pages=${pages + 1}`} />;
}

/**
 * The shop cancellation fee and each shop's cancellation count (order-fulfilment D14, R12a, A12).
 * Stacked on phone; `lg:` the field and the table side by side.
 */
export default async function FulfilmentSettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const pages = Math.max(1, Math.min(20, Number.parseInt(String(params.pages ?? "1"), 10) || 1));
  const view = await fulfilmentSettingsDAL.view();
  const lastChanged = view.updatedByName && view.updatedAt ? FEE_COPY.lastChanged(view.updatedByName, indiaDay(new Date(view.updatedAt))) : null;

  return (
    <PageShell width="default">
      <PageHeader title={FEE_COPY.title} />
      <div className="grid gap-6 lg:grid-cols-2">
        <FeeForm key={view.version} feeRupees={view.feeRupees} version={view.version} lastChanged={lastChanged} />
        {/* ux.md Partial: the saved field shows while the count loads. */}
        <Suspense fallback={<Skeleton className="h-40 rounded-card" />}>
          <Counts pages={pages} />
        </Suspense>
      </div>
    </PageShell>
  );
}
