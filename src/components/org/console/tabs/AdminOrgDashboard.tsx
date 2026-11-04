import { DashboardWidgets } from "@/components/dashboard/DashboardWidgets";
import { ROUTES } from "@server/shared/routes";

interface Props {
  orgId: string;
}

export async function AdminOrgDashboard({ orgId }: Props) {
  return (
    <DashboardWidgets
      ctx={{ audience: "org", orgId }}
      basePath={ROUTES.admin.home}
    />
  );
}
