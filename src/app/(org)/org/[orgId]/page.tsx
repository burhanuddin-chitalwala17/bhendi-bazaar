import { Suspense } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardWidgets } from "@/components/dashboard/DashboardWidgets";
import { RefreshButton } from "@/components/channel/refresh-button";
import { attentionLines } from "@/components/org/home/attention-lines";
import { HOME_COPY, doneToast } from "@/components/org/home/home-copy";
import { DoneToast, UpdatedLine } from "@/components/org/home/home-leaves";
import { NeedsYouNow } from "@/components/org/home/needs-you-now";
import { parseDoneStep } from "@/components/org/home/return-to";
import { SetupList } from "@/components/org/home/setup-list";
import { homeDAL } from "@/data-access-layer/org/home.dal";
import { requireOrgMember } from "@/lib/org-auth";

export const metadata = { robots: { index: false, follow: false } };

/**
 * Home (own-store onboarding R2, D7; Q5): greeting and link, what needs the shop now, the setup list
 * while it is open, then the numbers. Every section reads on its own and fails alone.
 */
export default async function OrgHome({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ done?: string | string[] }>;
}) {
  const { orgId } = await params;
  const { done } = await searchParams;
  const scope = await requireOrgMember(orgId);
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeBody orgId={scope.orgId} done={done} />
    </Suspense>
  );
}

async function HomeBody({ orgId, done }: { orgId: string; done: unknown }) {
  const now = new Date();
  const home = await homeDAL.forOrg(orgId, now);
  const lines = attentionLines(orgId, home.attention, now);
  const setup = home.setup.ok ? home.setup.value : null;
  const doneStep = parseDoneStep(done);
  const shop = home.shop.ok ? home.shop.value : null;

  return (
    <div className="space-y-6">
      {doneStep && setup && <DoneToast message={doneToast(doneStep, setup.doneCount)} />}

      <header className="space-y-1">
        <h1 className="line-clamp-2 font-heading text-2xl font-semibold text-foreground">{shop?.name ?? "Home"}</h1>
        {shop && (
          <Link href={shop.path} target="_blank" className="block truncate text-sm text-primary underline-offset-4 hover:underline">
            {shop.url}
          </Link>
        )}
        {shop && setup && !setup.complete && <p className="text-sm text-muted-foreground">{HOME_COPY.welcome(shop.name)}</p>}
      </header>

      {setup?.complete && lines.length === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground">{HOME_COPY.allCaughtUp}</p>
          <Button asChild variant="outline" size="sm" className="min-h-11">
            <Link href={`/org/${orgId}/shop`}>{HOME_COPY.shareShop}</Link>
          </Button>
        </div>
      )}

      <div className="space-y-6 md:grid md:grid-cols-2 md:items-start md:gap-6 md:space-y-0">
        <NeedsYouNow lines={lines} />
        <SetupList orgId={orgId} setup={home.setup} shopPath={shop?.path ?? null} />
      </div>

      <section className="space-y-3" aria-labelledby="your-numbers">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="your-numbers" className="font-heading text-base font-semibold">{HOME_COPY.numbers}</h2>
          <UpdatedLine readAt={home.readAt} />
        </div>
        {!home.hasPaidOrder.ok ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">{HOME_COPY.lineFailed}</p>
            <RefreshButton label={HOME_COPY.tryAgain} />
          </div>
        ) : home.hasPaidOrder.value ? (
          <DashboardWidgets
            ctx={{ audience: "org", orgId }}
            basePath={`/org/${orgId}`}
            gridClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
            prefetched={home.widgets}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{HOME_COPY.numbersBeforeFirstOrder}</p>
        )}
      </section>
    </div>
  );
}

/** ux Home Loading: a skeleton per section while Home reads. */
function HomeSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div className="space-y-3 md:grid md:grid-cols-2 md:gap-6 md:space-y-0">
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
      <Skeleton className="h-24" />
    </div>
  );
}
