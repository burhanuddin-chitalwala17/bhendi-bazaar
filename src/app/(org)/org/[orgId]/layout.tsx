import { redirect } from "next/navigation";
import { requireOrgMember } from "@/lib/org-auth";
import { OrgSidebar } from "@/org/sidebar";
import { isDomainError } from "@server/shared/domain-error";
import { orgMemberRepository } from "@server/catalog/org.member.repository";
import { requireSession } from "@/lib/admin-auth";
import { PortalHeader } from "@/components/layout/PortalHeader";

/**
 * Everything beneath this path belongs to one org, so membership is established once
 * here rather than in each page. A page still scopes its own queries — the layout
 * proves who you are, not what a query may return.
 */
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
    // 401 means sign in and come back; 403 means this account will never have access,
    // so sending it to a sign-in page would be a loop.
    if (isDomainError(error) && error.status === 401) {
      redirect(`/signin?callbackUrl=/org/${orgId}`);
    }
    redirect("/");
  }

  // The switcher needs every org this person can act for, and the header needs who
  // they are — both fetched here once, server-side, for everything beneath.
  const session = await requireSession();
  const orgs = await orgMemberRepository.listOrgsForUser(session.user.id);

  return (
    <div className="flex min-h-screen">
      <OrgSidebar orgId={orgId} orgs={orgs} />
      <div className="flex min-w-0 flex-1 flex-col">
        <PortalHeader
          name={session.user.name}
          email={session.user.email}
          label="Org Portal"
        />
        <main className="min-w-0 flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
