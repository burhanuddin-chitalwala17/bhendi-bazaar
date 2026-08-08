/**
 * Admin Dashboard Page
 * Main dashboard with statistics and metrics
 */

"use client";

import { useAsyncData } from "@/hooks/core/useAsyncData";
import { toast } from "sonner";
import { StatsCard } from "@/admin/stats-card";
import {
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  TrendingUp,
  Clock,
  RefreshCw,
} from "lucide-react";
import { adminDashboardApiClient } from "@/services/admin/dashboardApiClient";
import { LoadingSkeleton } from "@/components/shared/states/LoadingSkeleton";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { formatCurrency } from "@/lib/format";
import { useEffect } from "react";

export default function AdminDashboardPage() {
  const {
    data: stats,
    loading: isLoadingStats,
    error: errorStats,
    refetch: refetchStats,
  } = useAsyncData(() => adminDashboardApiClient.getDashboardStats(), {
    refetchDependencies: [],
  });
  const {
    data: activities,
    loading: isLoadingActivities,
    error: errorActivities,
    refetch: refetchActivities,
  } = useAsyncData(() => adminDashboardApiClient.getRecentActivities(10), {
    refetchDependencies: [],
  });

  const handleRefresh = async () => {
    await Promise.all([refetchStats(), refetchActivities()]);
    toast.success("Dashboard refreshed!");
  };


  // Can also add auto-refresh
  useEffect(() => {
    const interval = setInterval(() => {
      refetchStats();
      refetchActivities();
    }, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, [refetchStats, refetchActivities]);


  if (isLoadingStats || isLoadingActivities) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <SectionHeader
            overline="Welcome to Bhendi Bazaar Admin Panel"
            title="Dashboard"
            action={{
              label: "Refresh",
              onClick: handleRefresh,
            }}
          />
        </div>
      </div>

      {/* Revenue Stats */}
      <div>
        <SectionHeader overline="Revenue" title="Revenue" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatsCard
            title="Today"
            value={formatCurrency(stats?.revenue.today || 0)}
            icon={DollarSign}
          />
          <StatsCard
            title="This Week"
            value={formatCurrency(stats?.revenue.week || 0)}
            icon={TrendingUp}
          />
          <StatsCard
            title="This Month"
            value={formatCurrency(stats?.revenue.month || 0)}
            icon={DollarSign}
          />
          <StatsCard
            title="This Year"
            value={formatCurrency(stats?.revenue.year || 0)}
            icon={TrendingUp}
          />
        </div>
      </div>

      {/* Key Metrics */}
      <div>
        <SectionHeader overline="Key Metrics" title="Key Metrics" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatsCard
            title="Total Orders"
            value={stats?.orders.total || 0}
            icon={ShoppingCart}
            description={`${stats?.orders.todayCount || 0} today`}
          />
          <StatsCard
            title="Total Products"
            value={stats?.products.total || 0}
            icon={Package}
            description={`${stats?.products.lowStock || 0} low stock`}
          />
          <StatsCard
            title="Total Customers"
            value={stats?.customers.total || 0}
            icon={Users}
            description={`${stats?.customers.active || 0} active`}
          />
        </div>
      </div>

      {/* Order Status Overview */}
      <div>
        <SectionHeader overline="Order Status" title="Order Status" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-card rounded-lg border border-border p-6">
            <p className="text-sm font-medium text-muted-foreground">Processing</p>
            <p className="text-2xl font-bold text-warning mt-2">
              {stats?.orders.processing || 0}
            </p>
          </div>
          <div className="bg-card rounded-lg border border-border p-6">
            <p className="text-sm font-medium text-muted-foreground">Packed</p>
            <p className="text-2xl font-bold text-info mt-2">
              {stats?.orders.packed || 0}
            </p>
          </div>
          <div className="bg-card rounded-lg border border-border p-6">
            <p className="text-sm font-medium text-muted-foreground">Shipped</p>
            <p className="text-2xl font-bold text-accent-foreground mt-2">
              {stats?.orders.shipped || 0}
            </p>
          </div>
          <div className="bg-card rounded-lg border border-border p-6">
            <p className="text-sm font-medium text-muted-foreground">Delivered</p>
            <p className="text-2xl font-bold text-success mt-2">
              {stats?.orders.delivered || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
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

