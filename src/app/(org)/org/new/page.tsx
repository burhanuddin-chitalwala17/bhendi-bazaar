import { requireSession } from "@/lib/admin-auth";
import { OpenShopForm } from "@/components/org/open-shop-form";

import { PageHeader, PageShell } from "@/components/shared/page-shell";
export const metadata = {
  title: "Open your shop",
  robots: { index: false, follow: false },
};

/**
 * Outside `/org/[orgId]`, so it is not behind the membership check — there is no org to
 * be a member of yet. Signed in is the only requirement.
 */
export default async function NewOrgPage() {
  const session = await requireSession();

  return (
    <PageShell width="narrow" className="px-6 py-12">
      <PageHeader
        title="Open your shop"
        description="Two things now; the rest when you need it."
      />
      <OpenShopForm accountEmail={session.user.email} />
    </PageShell>
  );
}
