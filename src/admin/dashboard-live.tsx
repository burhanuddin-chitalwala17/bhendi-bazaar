"use client";

/**
 * The platform richness the widget registry doesn't model — period revenue, the
 * order-status overview and the activity feed — kept as a client island because
 * refresh (manual) is interactivity. The key-metrics row that used to live here
 * is the registry now (dashboard-widgets TRD D6). No auto-refresh interval: at
 * ~14 Prisma ops per tick, a forgotten open tab was the store's largest single
 * consumer of the DB-operations budget.
 */

import { useAsyncData } from "@/hooks/core/useAsyncData";
import { toast } from "sonner";
import { StatsCard } from "@/admin/stats-card";
import { DollarSign, TrendingUp, Clock } from "lucide-react";
import { adminDashboardApiClient } from "@/services/admin/dashboardApiClient";
import { LoadingSkeleton } from "@/components/shared/states/LoadingSkeleton";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { formatCurrency } from "@/lib/format";

export function AdminDashboardLive() {
  const {
    data: stats,
    loading: isLoadingStats,
    refetch: refetchStats,
  } = useAsyncData(() => adminDashboardApiClient.getDashboardStats(), {
    refetchDependencies: [],
  });
  const {
    data: activities,
    loading: isLoadingActivities,
    refetch: refetchActivities,
  } = useAsyncData(() => adminDashboardApiClient.getRecentActivities(10), {
    refetchDependencies: [],
  });

  const handleRefresh = async () => {
    await Promise.all([refetchStats(), refetchActivities()]);
    toast.success("Dashboard refreshed!");
  };

  if (isLoadingStats || isLoadingActivities) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-8">
      <div>
        <SectionHeader
          overline="Revenue"
          title="Revenue"
          action={{ label: "Refresh", onClick: handleRefresh }}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          <StatsCard title="Today" value={formatCurrency(stats?.revenue.today || 0)} icon={DollarSign} />
          <StatsCard title="This Week" value={formatCurrency(stats?.revenue.week || 0)} icon={TrendingUp} />
          <StatsCard title="This Month" value={formatCurrency(stats?.revenue.month || 0)} icon={DollarSign} />
          <StatsCard title="This Year" value={formatCurrency(stats?.revenue.year || 0)} icon={TrendingUp} />
        </div>
      </div>

      <div>
        <SectionHeader overline="Order Status" title="Order Status" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          <div className="bg-card rounded-lg border border-border p-6">
            <p className="text-sm font-medium text-muted-foreground">Processing</p>
            <p className="text-2xl font-bold text-warning mt-2">{stats?.orders.processing || 0}</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-6">
            <p className="text-sm font-medium text-muted-foreground">Packed</p>
            <p className="text-2xl font-bold text-info mt-2">{stats?.orders.packed || 0}</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-6">
            <p className="text-sm font-medium text-muted-foreground">Shipped</p>
            <p className="text-2xl font-bold text-accent-foreground mt-2">{stats?.orders.shipped || 0}</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-6">
            <p className="text-sm font-medium text-muted-foreground">Delivered</p>
            <p className="text-2xl font-bold text-success mt-2">{stats?.orders.delivered || 0}</p>
          </div>
        </div>
      </div>

      <div>
        <SectionHeader overline="Recent Activity" title="Recent Activity" />
        <div className="bg-card rounded-lg border border-border divide-y divide-border">
          {activities?.map((activity) => (
            <div key={activity.id} className="p-4 flex items-start gap-4">
              <div className="p-2 bg-muted rounded-lg">
                <Clock className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">{activity.title}</p>
                <p className="text-sm text-muted-foreground">{activity.description}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(activity.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
