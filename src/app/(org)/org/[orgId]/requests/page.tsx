import { requireOrgMember } from "@/lib/org-auth";
import { PageHeader } from "@/components/shared/page-shell";
import { YourRequests } from "@/components/requests/your-requests";
import { REQUESTS_COPY } from "@/components/requests/requests-copy";
import { requestsDAL } from "@/data-access-layer/requests.dal";
import { ORG_PAGE_TITLES } from "@/app/(org)/org/org-pages-copy";

export const metadata = { title: ORG_PAGE_TITLES.requests, robots: { index: false, follow: false } };

/** The shop's requests, for any part of the shop (setup-requests Q25, Q33): its own sidebar item, not a marketplace's. */
export default async function OrgRequestsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const scope = await requireOrgMember(orgId);
  const tickets = await requestsDAL.forShop(scope.orgId);
  return (
    <div className="space-y-6">
      <PageHeader help="requests" title={ORG_PAGE_TITLES.requests} description={REQUESTS_COPY.pageIntro} />
      <YourRequests orgId={scope.orgId} tickets={tickets} />
    </div>
  );
}
