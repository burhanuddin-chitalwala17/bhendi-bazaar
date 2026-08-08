import { DashboardWidgets } from "@/components/dashboard/DashboardWidgets";
import { AdminDashboardLive } from "@/admin/dashboard-live";
import { SectionHeader } from "@/components/shared/SectionHeader";

/**
 * The platform dashboard: key metrics come from the widget registry (the same
 * declarations the org portal renders, platform-scoped — dashboard-widgets R1–R4),
 * server-rendered; the live period/status/activity view stays a client island.
 */
export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <SectionHeader overline="Welcome to Bhendi Bazaar Admin Panel" title="Dashboard" />

      <DashboardWidgets ctx={{ audience: "platform" }} basePath="/admin" />

      <AdminDashboardLive />
    </div>
  );
}
