import { notFound } from "next/navigation";

import { requireOrgMember } from "@/lib/org-auth";
import { platformListingDAL } from "@/data-access-layer/platform-listing.dal";
import { PageShell } from "@/components/shared/page-shell";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { ReviewPublish } from "@/components/channel/review-publish";
import { PUBLISH } from "@/components/channel/platform-listing-copy";

export const metadata = {
  title: "Review changes",
  robots: { index: false, follow: false },
};

/** Review and publish (marketplace-publish ux.md): every change old against new; nothing is sent until Publish. */
export default async function ReviewPublishPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; channel: string }>;
  searchParams: Promise<{ listing?: string }>;
}) {
  const [{ orgId, channel }, { listing }] = await Promise.all([params, searchParams]);
  const scope = await requireOrgMember(orgId);
  const review = await platformListingDAL.review(scope.orgId, channel, listing);
  if (!review) notFound();
  return (
    <PageShell width="narrow">
      <SectionHeader as="h1" help="channels" title={PUBLISH.reviewTitle(review.label)} description={PUBLISH.nothingSent} />
      <ReviewPublish orgId={scope.orgId} review={review} single={listing ?? null} />
    </PageShell>
  );
}
