/**
 * Admin Dashboard Service (Client-side)
 * Handles API calls for dashboard data
 */

import type {
  DashboardStats,
  RecentActivity,
  RevenueChart,
} from "@/domain/admin";

class AdminDashboardService {

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const response = await fetch("/api/admin/dashboard");

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch dashboard stats");
    }

    return response.json();
  }

  /**
   * Get recent activities
   */
  async getRecentActivities(limit: number = 10): Promise<RecentActivity[]> {
    const response = await fetch(`/api/admin/dashboard/activities?limit=${limit}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch activities");
    }

    return response.json();
  }

  /**
   * Get revenue chart data
   */
  async getRevenueChart(days: number = 30): Promise<RevenueChart[]> {
    const response = await fetch(`/api/admin/dashboard/revenue?days=${days}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch revenue data");
    }

    return response.json();
  }
}

export const adminDashboardService = new AdminDashboardService();


