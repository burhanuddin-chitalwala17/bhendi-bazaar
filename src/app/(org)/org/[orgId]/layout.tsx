import { redirect } from "next/navigation";
import { requireOrgMember } from "@/lib/org-auth";
import { OrgSidebar } from "@/org/sidebar";
import { isDomainError } from "@server/shared/domain-error";
import { orgRepository } from "@server/catalog/org.repository";

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

  const org = await orgRepository.findById(orgId);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <OrgSidebar orgId={orgId} orgName={org?.name ?? "Organisation"} />
      <main className="flex-1 p-8 min-w-0">{children}</main>
    </div>
  );
}
