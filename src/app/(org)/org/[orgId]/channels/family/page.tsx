import { notFound } from "next/navigation";

import { requireOrgMember } from "@/lib/org-auth";
import { channelFamilyDAL } from "@/data-access-layer/channel-family.dal";
import { PageShell, PageHeader } from "@/components/shared/page-shell";
import { FamilyForm } from "@/components/channel/family-form";
import { FAMILY } from "@/components/channel/family-copy";
import { ROUTES } from "@server/shared/routes";
import { ORG_PAGE_TITLES } from "@/app/(org)/org/org-pages-copy";

export const metadata = {
  title: ORG_PAGE_TITLES.family,
  robots: { index: false, follow: false },
};

/** Several marketplace listings made one family, or added to one (family-merge ux.md "Family page"). */
export default async function FamilyPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ listings?: string }>;
}) {
  const { orgId } = await params;
  const { listings } = await searchParams;
  const ids = (listings ?? "").split(",").map((id) => id.trim()).filter(Boolean).slice(0, 100);
  if (ids.length === 0) notFound();
  const scope = await requireOrgMember(orgId);
  const data = await channelFamilyDAL.page(scope.orgId, ids);
  if (!data) notFound();
  const { detail } = data;
  const backHref = `${ROUTES.org.channelListings(scope.orgId, detail.channel)}?tab=notLinked`;
  const word = detail.members.length === 1 ? "listing" : "listings";

  return (
    <PageShell width="narrow">
      <PageHeader
        help="channels"
        title={detail.family ? FAMILY.titleAdd(detail.family.name) : FAMILY.titleNew}
        description={FAMILY.subtitle(detail.label, detail.members.length, word)}
      />
      <FamilyForm orgId={scope.orgId} detail={detail} categories={data.categories} backHref={backHref} />
    </PageShell>
  );
}
