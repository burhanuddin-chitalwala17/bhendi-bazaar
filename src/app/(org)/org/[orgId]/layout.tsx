import { redirect } from "next/navigation";
import { Ban } from "lucide-react";
import { requireOrgMember } from "@/lib/org-auth";
import { OrgSidebar } from "@/components/layout/OrgSidebar";
import { isDomainError } from "@server/shared/domain-error";
import { orgMemberRepository } from "@server/catalog/org.member.repository";
import { requireSession } from "@/lib/admin-auth";
import { PortalHeader } from "@/components/layout/PortalHeader";
import { PageShell } from "@/components/shared/page-shell";

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
  const orgs = await orgMemberRepository.listOrgsForUser(session.user.id);
  const currentOrg = orgs.find((org) => org.id === orgId);
  const handle = currentOrg?.handle;

  if (currentOrg?.isBlocked) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <PageShell width="narrow" className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <Ban className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold">Organisation Suspended</h1>
          <p className="text-muted-foreground">
            This organisation has been suspended by the platform. Your products
            and storefront are not visible to customers. Contact support for
            more information.
          </p>
        </PageShell>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <OrgSidebar orgId={orgId} orgs={orgs} />
      <div className="flex min-w-0 flex-1 flex-col">
        <PortalHeader
          name={session.user.name}
          email={session.user.email}
          label="Org Portal"
          storefrontHref={handle ? `/store/${handle}` : undefined}
        />
        <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
