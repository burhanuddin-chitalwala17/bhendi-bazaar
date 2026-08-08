/**
 * Admin User Service (Client-side)
 * Handles API calls for user management
 */

import type { AdminUser, UserListFilters, UserListResult } from "@/domain/admin";

class AdminUserService {
  /**
   * Get paginated list of users
   */
  async getUsers(filters: UserListFilters = {}): Promise<UserListResult> {
    const params = new URLSearchParams();

    if (filters.search) params.append("search", filters.search);
    if (filters.platformRole) params.append("platformRole", filters.platformRole);
    if (filters.isBlocked !== undefined)
      params.append("isBlocked", String(filters.isBlocked));
    if (filters.page) params.append("page", String(filters.page));
    if (filters.limit) params.append("limit", String(filters.limit));
    if (filters.sortBy) params.append("sortBy", filters.sortBy);
    if (filters.sortOrder) params.append("sortOrder", filters.sortOrder);

    const response = await fetch(`/api/admin/users?${params.toString()}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to fetch users");
    }

    return response.json();
  }


  /**
   * Update user
   */
  async updateUser(
    id: string,
    data: { name?: string; platformRole?: string; isBlocked?: boolean }
  ): Promise<AdminUser> {
    const response = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update user");
    }

    return response.json();
  }

  /**
   * Block/Unblock user
   */
  async toggleBlockUser(id: string, isBlocked: boolean): Promise<AdminUser> {
    const response = await fetch(`/api/admin/users/${id}/block`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isBlocked }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to update user status");
    }

    return response.json();
  }
}

export const adminUserApiClient = new AdminUserService();


