import { requireOrgMember } from "@/lib/org-auth";
import { DashboardWidgets } from "@/components/dashboard/DashboardWidgets";

export const metadata = { robots: { index: false, follow: false } };

/**
 * The org dashboard: the widget registry rendered with an org scope. Which figures
 * appear here — and how each is narrowed to this org — is declared per widget in
 * server/analytics/widgets.ts, not decided by this page (dashboard-widgets R1–R4).
 */
export default async function OrgDashboard({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const scope = await requireOrgMember(orgId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">An overview of your organisation</p>
      </div>

      <DashboardWidgets
        ctx={{ audience: "org", orgId: scope.orgId }}
        basePath={`/org/${scope.orgId}`}
      />
    </div>
  );
}
