/** An organisation's bidding events — scoped by membership, never by a query parameter. */
import { requireOrgMember } from "@/lib/org-auth";
import { biddingService } from "@server/bidding/bidding.service";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { BiddingList } from "@/components/bidding/BiddingList";
import { CreateBiddingDialog } from "@/components/bidding/CreateBiddingDialog";
import { ORG_PAGES_COPY } from "@/components/org/pages-copy";
import { ROUTES } from "@server/shared/routes";

export const metadata = { robots: { index: false, follow: false } };

export default async function OrgBiddingPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const scope = await requireOrgMember(orgId);
  const events = await biddingService.listForOrg(scope.orgId);

  return (
    <PageShell width="wide">
      <PageHeader
        help="bidding"
        title={ORG_PAGES_COPY.biddingTitle}
        description={ORG_PAGES_COPY.biddingDescription}
        actions={
          <CreateBiddingDialog
            basePath={ROUTES.org.bidding(scope.orgId)}
            searchPath={`/api/org/${scope.orgId}/bidding/products`}
          />
        }
      />
      <BiddingList
        events={events}
        apiPath={`/api/org/${scope.orgId}/bidding`}
      />
    </PageShell>
  );
}
