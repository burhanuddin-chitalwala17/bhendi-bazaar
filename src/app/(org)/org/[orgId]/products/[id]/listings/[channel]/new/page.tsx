import { notFound } from "next/navigation";

import { requireOrgMember } from "@/lib/org-auth";
import { platformListingDAL } from "@/data-access-layer/platform-listing.dal";
import { PageShell, PageHeader } from "@/components/shared/page-shell";
import { PutOnMarketplace } from "@/components/channel/put-on-marketplace";
import { CREATE } from "@/components/channel/platform-listing-copy";
import { ORG_PAGE_TITLES } from "@/app/(org)/org/org-pages-copy";
import { PlanBanner } from "@/components/subscriptions/plan-banner";
import { LockedAction } from "@/components/subscriptions/locked-action";
import { FEATURE } from "@/components/subscriptions/features";

export const metadata = {
  title: ORG_PAGE_TITLES.newListing,
  robots: { index: false, follow: false },
};

/** Put on Amazon (marketplace-publish ux.md): its page looked for first, then sell on it or make a new one. */
export default async function PutOnMarketplacePage({ params }: { params: Promise<{ orgId: string; id: string; channel: string }> }) {
  const { orgId, id, channel } = await params;
  const scope = await requireOrgMember(orgId);
  const start = await platformListingDAL.createStart(scope.orgId, id, channel);
  if (!start) notFound();
  return (
    <PageShell width="narrow">
      <PageHeader help="channels" title={CREATE.putOn(start.label)} description={start.productName} />
      {/* Opened by its link while Channels is locked: the page explains the plan and never searches the marketplace (feature-access Q29). */}
      {scope.features.channels ? (
        <PutOnMarketplace orgId={scope.orgId} start={start} />
      ) : (
        <div className="space-y-3">
          <PlanBanner feature={FEATURE.CHANNELS} />
          <div className="flex flex-wrap gap-2">
            <LockedAction feature={FEATURE.CHANNELS} label={CREATE.sellHere} variant="outline" className="min-h-10">{null}</LockedAction>
            <LockedAction feature={FEATURE.CHANNELS} label={CREATE.createNew} className="min-h-10">{null}</LockedAction>
          </div>
        </div>
      )}
    </PageShell>
  );
}
