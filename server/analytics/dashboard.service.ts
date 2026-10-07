import { adminDashboardRepository } from "@server/analytics/dashboard.repository";
import type {
  DashboardStats,
  RecentActivity,
} from "@server/analytics/dashboard.types";

export class AdminDashboardService {
  async getDashboardStats(): Promise<DashboardStats> {
    return await adminDashboardRepository.getDashboardStats();
  }

  async getRecentActivities(limit: number = 10): Promise<RecentActivity[]> {
    return await adminDashboardRepository.getRecentActivities(limit);
  }
}

export const adminDashboardService = new AdminDashboardService();
