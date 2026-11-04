import { Suspense } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { parsePeriod } from "@/components/dashboard/period";
import { PeriodControl } from "@/components/dashboard/period-control";
import { ShopSalesBlock } from "@/components/dashboard/shop-sales";
import { ActionBar } from "@/components/shared/action-bar";
import { PageHeader } from "@/components/shared/page-shell";
import { SkeletonHeader, SkeletonRows, SkeletonTiles } from "@/components/shared/states/skeletons";
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
import type { SalesPeriod } from "@server/analytics/sales.types";
import { homeDAL } from "@/data-access-layer/org/home.dal";
import { requireOrgMember } from "@/lib/org-auth";

export const metadata = { robots: { index: false, follow: false } };

/**
 * Home (own-store onboarding R2, D7; Q5), laid out as the admin dashboard is (design-system Q34):
 * sales for the period in the URL beside what needs the shop now, then setup and the share link.
 * Before the first paid order the setup list takes the sales block's place. Each section fails alone.
 */
export default async function OrgHome({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ done?: string | string[]; period?: string | string[] }>;
}) {
  const { orgId } = await params;
  const { done, period } = await searchParams;
  const scope = await requireOrgMember(orgId);
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeBody orgId={scope.orgId} done={done} period={parsePeriod(period)} />
    </Suspense>
  );
}

async function HomeBody({ orgId, done, period }: { orgId: string; done: unknown; period: SalesPeriod }) {
  const now = new Date();
  const home = await homeDAL.forOrg(orgId, now);
  const lines = attentionLines(orgId, home.attention, now);
  const setup = home.setup.ok ? home.setup.value : null;
  const doneStep = parseDoneStep(done);
  const shop = home.shop.ok ? home.shop.value : null;
  const shareSetup = setup ? shareSetupOf(setup) : null;
  // After the first product the toast offers Share as well (R10); Home's link carries the sheet.
  const productToast = doneStep === ONBOARDING_STEP.PRODUCT && shop && setup ? doneToast(doneStep, setup.doneCount) : null;
  const hasSales = home.hasPaidOrder.ok && home.hasPaidOrder.value;
  const here = `/org/${orgId}?period=${period}`;
  const toPack = home.attention.toPack.ok ? home.attention.toPack.value.count : null;

  return (
    <div className="space-y-6">
      {doneStep && setup && !productToast && <DoneToast message={doneToast(doneStep, setup.doneCount)} />}

      <PageHeader
        help="home"
        title={shop?.name ?? "Home"}
        description={shop && setup && !setup.complete ? HOME_COPY.welcome(shop.name) : undefined}
        actions={hasSales ? <PeriodControl current={period} basePath={`/org/${orgId}`} /> : undefined}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-2 lg:col-span-2">
          {hasSales ? (
            <>
              <Suspense key={period} fallback={<SalesSkeleton />}>
                <ShopSalesBlock orgId={orgId} period={period} retryHref={here} toPack={toPack} />
              </Suspense>
              <UpdatedLine readAt={home.readAt} />
            </>
          ) : (
            <div className="space-y-3">
              <SetupList orgId={orgId} setup={home.setup} share={shop} />
              {home.hasPaidOrder.ok ? (
                <p className="text-small text-muted-foreground">{HOME_COPY.numbersBeforeFirstOrder}</p>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-small text-muted-foreground">{HOME_COPY.lineFailed}</p>
                  <RefreshButton label={HOME_COPY.tryAgain} />
                </div>
              )}
            </div>
          )}
        </div>
        {/* On a phone what needs the shop comes before its numbers; side by side from desktop. */}
        <div className="order-first space-y-6 lg:order-none">
          <NeedsYouNow lines={lines} />
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
        </div>
      </div>

      {hasSales && !setup?.complete && <SetupList orgId={orgId} setup={home.setup} share={shop} />}

      {shop && <HomeShareLink orgId={orgId} shop={shop} setup={shareSetup} productToast={productToast} />}

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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SalesSkeleton />
        </div>
        <SkeletonRows count={3} thumbnail={false} />
      </div>
      <Skeleton className="h-16 rounded-card" />
    </div>
  );
}

function SalesSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading sales">
      <Skeleton className="h-72 rounded-card" />
      <SkeletonTiles count={4} className="sm:grid-cols-2 lg:grid-cols-4" />
    </div>
  );
}
