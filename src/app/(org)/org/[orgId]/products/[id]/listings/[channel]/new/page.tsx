import { notFound } from "next/navigation";

import { requireOrgMember } from "@/lib/org-auth";
import { platformListingDAL } from "@/data-access-layer/platform-listing.dal";
import { PageShell } from "@/components/shared/page-shell";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { PutOnMarketplace } from "@/components/channel/put-on-marketplace";
import { CREATE } from "@/components/channel/platform-listing-copy";

export const metadata = {
  title: "Put on a marketplace",
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
      <SectionHeader as="h1" help="channels" title={CREATE.putOn(start.label)} description={start.productName} />
      <PutOnMarketplace orgId={scope.orgId} start={start} />
    </PageShell>
  );
}
