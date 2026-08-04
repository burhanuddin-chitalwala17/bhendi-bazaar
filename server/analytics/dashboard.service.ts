/**
 * Admin Dashboard Service
 * Business logic for dashboard statistics and analytics
 */

import { adminDashboardRepository } from "@server/analytics/dashboard.repository";
import type {
  DashboardStats,
  RecentActivity,
  TopProduct,
  RevenueChart,
} from "@server/analytics/dashboard.types";

export class AdminDashboardService {
  /**
   * Get comprehensive dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    return await adminDashboardRepository.getDashboardStats();
  }

  /**
   * Get recent activities
   */
  async getRecentActivities(limit: number = 10): Promise<RecentActivity[]> {
    return await adminDashboardRepository.getRecentActivities(limit);
  }

  /**
   * Get top selling products
   */
  async getTopProducts(limit: number = 5): Promise<TopProduct[]> {
    return await adminDashboardRepository.getTopProducts(limit);
  }

  /**
   * Get revenue chart data
   */
  async getRevenueChart(days: number = 30): Promise<RevenueChart[]> {
    if (days < 1 || days > 365) {
      throw new Error("Days must be between 1 and 365");
    }

    return await adminDashboardRepository.getRevenueChart(days);
  }
}

export const adminDashboardService = new AdminDashboardService();


