import { notFound } from "next/navigation";

import { requireOrgMember } from "@/lib/org-auth";
import { readinessFixDAL } from "@/data-access-layer/org/readiness-fix.dal";
import { PageShell, PageHeader } from "@/components/shared/page-shell";
import { ReadinessFix } from "@/components/channel/readiness-fix";
import { FIX } from "@/components/channel/readiness-fix-copy";

export const metadata = {
  title: "Fix what is missing",
  robots: { index: false, follow: false },
};

/** One missing fact for one channel, answered across products (readiness-fix ux.md "Fix page"). */
export default async function ReadinessFixPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ channel?: string; fact?: string }>;
}) {
  const [{ orgId }, { channel, fact }] = await Promise.all([params, searchParams]);
  const scope = await requireOrgMember(orgId);
  const page = channel && fact ? await readinessFixDAL.page(scope.orgId, channel, fact) : null;
  if (!page) notFound();
  return (
    <PageShell width="form">
      <PageHeader help="products" title={FIX.title(page.factLabel, page.channelLabel)} />
      <ReadinessFix orgId={scope.orgId} page={page} />
    </PageShell>
  );
}
