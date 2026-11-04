import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { SkeletonRows, SkeletonTiles } from "@/components/shared/states/skeletons";
import { LatestOrdersBlock } from "@/components/dashboard/latest-orders";
import { NeedsActionBlock } from "@/components/dashboard/needs-action";
import { parsePeriod } from "@/components/dashboard/period";
import { PeriodControl } from "@/components/dashboard/period-control";
import { SalesOverviewBlock } from "@/components/dashboard/sales-overview";
import { WorkerStatusCard } from "@/components/dashboard/worker-status-card";
import { formatDate } from "@/lib/format";
import { DASHBOARD_COPY } from "@/components/dashboard/dashboard-copy";
import { ROUTES } from "@server/shared/routes";

/**
 * The platform dashboard (design-system Q30, Q31): sales for a period from the URL, what needs the
 * admin now, and the newest orders. Rendered on the server; each block streams behind its own
 * Suspense and fails alone, so one slow or broken read never holds the page.
 */
export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const period = parsePeriod((await searchParams).period);
  const here = `${ROUTES.admin.home}?period=${period}`;

  return (
    <PageShell width="wide">
      <PageHeader
        title={DASHBOARD_COPY.title}
        description={DASHBOARD_COPY.description(formatDate(new Date(), { weekday: "long", day: "numeric", month: "long" }))}
        actions={<PeriodControl current={period} basePath={ROUTES.admin.home} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Suspense key={period} fallback={<SalesSkeleton />}>
            <SalesOverviewBlock period={period} retryHref={here} />
          </Suspense>
        </div>
        <Suspense fallback={<SkeletonRows count={4} thumbnail={false} />}>
          <NeedsActionBlock period={period} retryHref={here} />
        </Suspense>
      </div>

      <Suspense fallback={<SkeletonRows count={5} thumbnail={false} />}>
        <LatestOrdersBlock retryHref={here} />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-24 rounded-card" />}>
        <WorkerStatusCard />
      </Suspense>
    </PageShell>
  );
}

function SalesSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label={DASHBOARD_COPY.loadingSales}>
      <Skeleton className="h-72 rounded-card" />
      <SkeletonTiles count={4} className="sm:grid-cols-2 lg:grid-cols-4" />
    </div>
  );
}
