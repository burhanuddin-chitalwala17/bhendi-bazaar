import { apiRequest } from "@/lib/api-client";
import type { DashboardStats, RecentActivity } from "@/domain/admin";

export const adminDashboardApiClient = {
  getDashboardStats(): Promise<DashboardStats> {
    return apiRequest("/api/admin/dashboard");
  },

  getRecentActivities(limit: number = 10): Promise<RecentActivity[]> {
    return apiRequest(`/api/admin/dashboard/activities?limit=${limit}`);
  },
};
