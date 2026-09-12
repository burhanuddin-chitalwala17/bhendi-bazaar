/** An organisation's bidding events — scoped by membership, never by a query parameter. */
import { requireOrgMember } from "@/lib/org-auth";
import { biddingService } from "@server/bidding/bidding.service";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { BiddingList } from "@/components/bidding/BiddingList";
import { CreateBiddingDialog } from "@/components/bidding/CreateBiddingDialog";

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
        title="Bidding"
        description="Put one item up for timed bidding and share the link. While it runs, that item stays on the site but cannot be bought directly."
        actions={
          <CreateBiddingDialog
            basePath={`/org/${scope.orgId}/bidding`}
            searchPath={`/api/org/${scope.orgId}/bidding/products`}
          />
        }
      />
      <BiddingList events={events} apiPath={`/api/org/${scope.orgId}/bidding`} />
    </PageShell>
  );
}
