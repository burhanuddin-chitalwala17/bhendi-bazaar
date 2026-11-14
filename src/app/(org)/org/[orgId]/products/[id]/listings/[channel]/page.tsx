import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOrgMember } from "@/lib/org-auth";
import { platformListingDAL } from "@/data-access-layer/platform-listing.dal";
import { PageShell, PageHeader } from "@/components/shared/page-shell";
import { ListingEditor } from "@/components/channel/listing-editor";
import { ListingLocked } from "@/components/channel/listing-locked";
import { ListingStatusLine } from "@/components/channel/listing-status-line";
import { ListingIssuesBanner } from "@/components/channel/listing-issues-banner";
import { ListingDraftBanner } from "@/components/channel/listing-draft-banner";
import { LISTING } from "@/components/channel/platform-listing-copy";
import { ROUTES } from "@server/shared/routes";
import { safeReturnPath, withFrom } from "@/lib/safe-callback-url";
import { ORG_PAGE_TITLES } from "@/app/(org)/org/org-pages-copy";

export const metadata = {
  title: ORG_PAGE_TITLES.listing,
  robots: { index: false, follow: false },
};

/** A product's listing on one marketplace (channel-listings ux.md "Listing screen"). */
export default async function ListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string; id: string; channel: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { orgId, id, channel } = await params;
  const { from } = await searchParams;
  const scope = await requireOrgMember(orgId);
  const [screen, tickets] = await Promise.all([platformListingDAL.screen(scope.orgId, id, channel), platformListingDAL.tickets(scope.orgId, id)]);
  if (!screen) notFound();
  // Back goes where this screen was opened from (Listings, filters kept); else to the product (navigation-flows Q6).
  const productHref = ROUTES.org.product(scope.orgId, id);
  const back = safeReturnPath(from, productHref);
  const fromListings = back.startsWith(ROUTES.org.channelListings(scope.orgId, channel));
  const self = back === productHref ? ROUTES.org.productListing(scope.orgId, id, channel) : withFrom(ROUTES.org.productListing(scope.orgId, id, channel), back);
  return (
    <PageShell width="narrow">
      <Link href={back} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
        ‹ {fromListings ? LISTING.backToListings : screen.productName}
      </Link>
      <PageHeader help="channels" title={LISTING.screenTitle(screen.label)} description={LISTING.intro(screen.label)} />
      <div>
        <ListingStatusLine status={screen.status} label={screen.label} />
      </div>
      <ListingIssuesBanner orgId={scope.orgId} screen={screen} tickets={tickets} from={self} />
      <ListingDraftBanner orgId={scope.orgId} screen={screen} from={self} />
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-3 lg:items-start">
        <div className="lg:col-span-2">
          <ListingEditor orgId={scope.orgId} screen={screen} />
        </div>
        <ListingLocked orgId={scope.orgId} screen={screen} from={self} />
      </div>
    </PageShell>
  );
}
