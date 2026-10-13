import { DashboardWidgets } from "@/components/dashboard/DashboardWidgets";

interface Props {
  orgId: string;
}

export async function AdminOrgDashboard({ orgId }: Props) {
  return (
    <DashboardWidgets
      ctx={{ audience: "org", orgId }}
      basePath="/admin"
    />
  );
}
