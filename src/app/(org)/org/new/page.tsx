import { requireSession } from "@/lib/admin-auth";
import { CreateOrg } from "@/org/create-org";

import { PageHeader, PageShell } from "@/components/shared/page-shell";
export const metadata = {
  title: "Create an organisation",
  robots: { index: false, follow: false },
};

/**
 * Outside `/org/[orgId]`, so it is not behind the membership check — there is no org to
 * be a member of yet. Signed in is the only requirement.
 */
export default async function NewOrgPage() {
  await requireSession();

  return (
    <PageShell width="narrow" className="px-6 py-12">
      <PageHeader
        title="Create an organisation"
        description="Selling happens through an organisation. You will be its first owner."
      />
      <CreateOrg />
    </PageShell>
  );
}
