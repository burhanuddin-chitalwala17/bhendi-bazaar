import { redirect } from "next/navigation";
import { requireOrgMember } from "@/lib/org-auth";
import { OrgSidebar } from "@/components/layout/OrgSidebar";
import { isDomainError } from "@server/shared/domain-error";
import { orgMemberRepository } from "@server/catalog/org.member.repository";
import { requireSession } from "@/lib/admin-auth";
import { PortalHeader } from "@/components/layout/PortalHeader";
import { PageShell } from "@/components/shared/page-shell";
import { ContactLauncher } from "@/components/support/contact-launcher";
import { PORTAL_COPY } from "@/components/layout/portal-copy";
import { Icon } from "@/components/ui/icon";
import { OrgSwitcher } from "@/components/org/org-switcher";
import { toPack } from "@server/analytics/attention.service";

/** The Orders tab's badge: parcels paid for and waiting on the shop. A failed read shows none, never a wrong one. */
async function toPackCount(orgId: string): Promise<number> {
  try {
    return (await toPack(orgId)).count;
  } catch {
    return 0;
  }
}

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;

  try {
    await requireOrgMember(orgId);
  } catch (error) {
    if (isDomainError(error) && error.status === 401) {
      redirect(`/signin?callbackUrl=/org/${orgId}`);
    }
    redirect("/");
  }

  const session = await requireSession();
  const [orgs, packCount] = await Promise.all([orgMemberRepository.listOrgsForUser(session.user.id), toPackCount(orgId)]);
  const currentOrg = orgs.find((org) => org.id === orgId);
  const handle = currentOrg?.handle;

  if (currentOrg?.isBlocked) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <PageShell width="narrow" className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
            <Icon name="blocked" size="xl" tone="destructive" />
          </div>
          <h1 className="font-heading text-headline font-semibold">{PORTAL_COPY.pausedTitle}</h1>
          <p className="text-body text-muted-foreground">{PORTAL_COPY.pausedBody}</p>
          <ContactLauncher className="min-h-11 border border-border px-4">
            {PORTAL_COPY.contactUs}
          </ContactLauncher>
        </PageShell>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <OrgSidebar orgId={orgId} orgs={orgs} signedIn={Boolean(session.user.email)} counts={{ orders: packCount }} />
      <div className="flex min-w-0 flex-1 flex-col">
        <PortalHeader
          name={session.user.name}
          email={session.user.email}
          label={PORTAL_COPY.headerLabel}
          storefrontHref={handle ? `/store/${handle}` : undefined}
          leading={<OrgSwitcher orgs={orgs} currentOrgId={orgId} variant="bar" />}
          search={{ href: `/org/${orgId}/products#search`, label: PORTAL_COPY.searchProducts }}
        />
        {/* Phone: clear the fixed tab bar, so the last row of every page stays tappable. */}
        <main className="min-w-0 flex-1 p-4 pb-tabbar md:p-8">{children}</main>
      </div>
    </div>
  );
}
