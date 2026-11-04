import { requireSession } from "@/lib/admin-auth";
import { appUrl } from "@server/shared/app-url";
import { UnauthorizedError } from "@server/shared/domain-error";
import { OpenShopForm } from "@/components/org/open-shop-form";
import { OPEN_SHOP_COPY as COPY } from "@/components/org/open-shop-copy";
import { SignInButton } from "@/components/auth/sign-in-button";

import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { ORG_PAGE_TITLES } from "@/app/(org)/org/org-pages-copy";
export const metadata = {
  title: ORG_PAGE_TITLES.openShop,
  robots: { index: false, follow: false },
};

/**
 * Outside `/org/[orgId]`, so it is not behind the membership check — there is no org to
 * be a member of yet. Signed out, it asks for sign-in in place and the sheet refreshes this
 * page (onboarding D4); the edge lets this one path through for that reason.
 */
export default async function NewOrgPage() {
  const session = await requireSession().catch((error: unknown) => {
    if (error instanceof UnauthorizedError) return null;
    throw error;
  });

  return (
    <PageShell width="narrow" className="px-4 py-8 sm:px-6 sm:py-12">
      <div className="md:mx-auto md:max-w-md md:rounded-card md:border md:border-border md:bg-card md:p-6">
        <PageHeader title={COPY.title} description={COPY.lead} />
        {session ? (
          <OpenShopForm
            accountEmail={session.user.email}
            storeBase={`${appUrl().replace(/^https?:\/\//, "")}/store/`}
          />
        ) : (
          <div className="flex flex-col items-start gap-3 rounded-card border border-border bg-card p-4">
            <p className="text-sm font-semibold">{COPY.signIn}</p>
            <SignInButton reason={COPY.signIn} className="h-11 px-6" />
          </div>
        )}
      </div>
    </PageShell>
  );
}
