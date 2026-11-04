import { Suspense } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardWidgets } from "@/components/dashboard/DashboardWidgets";
import { ActionBar } from "@/components/shared/action-bar";
import { PageHeader } from "@/components/shared/page-shell";
import { SkeletonHeader, SkeletonRows } from "@/components/shared/states/skeletons";
import { RefreshButton } from "@/components/channel/refresh-button";
import { attentionLines } from "@/components/org/home/attention-lines";
import { HOME_COPY, doneToast } from "@/components/org/home/home-copy";
import { DoneToast, UpdatedLine } from "@/components/org/home/home-leaves";
import { NeedsYouNow } from "@/components/org/home/needs-you-now";
import { parseDoneStep } from "@/components/org/home/return-to";
import { SetupList, shareSetupOf } from "@/components/org/home/setup-list";
import { HomeShareLink } from "@/components/org/home/home-share";
import { ShareShopSheet } from "@/components/org/share/share-shop-sheet";
import { ONBOARDING_STEP } from "@server/catalog/org-onboarding.types";
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
  const shareSetup = setup ? shareSetupOf(setup) : null;
  // After the first product the toast offers Share as well (R10); Home's link carries the sheet.
  const productToast = doneStep === ONBOARDING_STEP.PRODUCT && shop && setup ? doneToast(doneStep, setup.doneCount) : null;

  return (
    <div className="space-y-6">
      {doneStep && setup && !productToast && <DoneToast message={doneToast(doneStep, setup.doneCount)} />}

      <PageHeader
        help="home"
        title={shop?.name ?? "Home"}
        description={shop && setup && !setup.complete ? HOME_COPY.welcome(shop.name) : undefined}
      />

      {setup?.complete && lines.length === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-card p-4">
          <p className="flex items-center gap-2 text-small font-medium text-foreground">
            <Icon name="success" size="md" tone="success" />
            {HOME_COPY.allCaughtUp}
          </p>
          {shop ? (
            <ShareShopSheet
              orgId={orgId}
              shop={shop}
              setup={shareSetup}
              trigger={
                <Button type="button" variant="outline" size="sm">
                  {HOME_COPY.shareShop}
                </Button>
              }
            />
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href={`/org/${orgId}/shop`}>{HOME_COPY.shareShop}</Link>
            </Button>
          )}
        </div>
      )}

      <div className="space-y-6 md:grid md:grid-cols-2 md:items-start md:gap-6 md:space-y-0">
        <NeedsYouNow lines={lines} />
        <SetupList orgId={orgId} setup={home.setup} share={shop} />
      </div>

      {shop && <HomeShareLink orgId={orgId} shop={shop} setup={shareSetup} productToast={productToast} />}

      <section className="space-y-3" aria-labelledby="your-numbers">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="your-numbers" className="font-heading text-title font-semibold">{HOME_COPY.numbers}</h2>
          <UpdatedLine readAt={home.readAt} />
        </div>
        {!home.hasPaidOrder.ok ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-small text-muted-foreground">{HOME_COPY.lineFailed}</p>
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
          <p className="text-small text-muted-foreground">{HOME_COPY.numbersBeforeFirstOrder}</p>
        )}
      </section>

      <ActionBar className="-mx-4 md:mx-0">
        <Button asChild>
          <Link href={`/org/${orgId}/products/new`} prefetch={false}>
            <Icon name="add" size="sm" />
            {HOME_COPY.addProduct}
          </Link>
        </Button>
      </ActionBar>
    </div>
  );
}

/** ux Home Loading: a skeleton per section while Home reads. */
function HomeSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading your shop">
      <SkeletonHeader />
      <div className="space-y-3 md:grid md:grid-cols-2 md:gap-6 md:space-y-0">
        <SkeletonRows count={3} thumbnail={false} />
        <SkeletonRows count={5} thumbnail={false} />
      </div>
      <Skeleton className="h-16 rounded-card" />
    </div>
  );
}
