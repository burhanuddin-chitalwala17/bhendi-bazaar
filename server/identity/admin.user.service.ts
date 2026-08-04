/**
 * Admin User Service
 * Business logic for user management
 */

import { adminUserRepository } from "@server/identity/admin.user.repository";
import { adminLogRepository } from "@server/shared/audit/audit.repository";
import type {
  UserListFilters,
  UserListResult,
  UpdateUserInput,
  UserStats,
  AdminUser,
} from "@server/identity/admin.user.types";

export class AdminUserService {
  /**
   * Get paginated list of users
   */
  async getUsers(filters: UserListFilters): Promise<UserListResult> {
    const { users, total } = await adminUserRepository.getUsers(filters);

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const totalPages = Math.ceil(total / limit);

    return {
      users,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Get single user by ID
   */
  async getUserById(id: string): Promise<AdminUser | null> {
    return await adminUserRepository.getUserById(id);
  }

  /**
   * Update user
   */
  async updateUser(
    id: string,
    adminId: string,
    data: UpdateUserInput
  ): Promise<AdminUser | null> {
    // Validate role if provided
    if (data.role && !["USER", "ADMIN"].includes(data.role)) {
      throw new Error("Invalid role. Must be USER or ADMIN");
    }

    const user = await adminUserRepository.updateUser(id, data);

    if (user) {
      // Log the action
      await adminLogRepository.createLog({
        adminId,
        action: "USER_UPDATED",
        resource: "User",
        resourceId: id,
        metadata: { changes: data },
      });
    }

    return user;
  }

  /**
   * Block/Unblock user
   */
  async toggleBlockUser(
    id: string,
    adminId: string,
    isBlocked: boolean
  ): Promise<AdminUser | null> {
    const user = await adminUserRepository.updateUser(id, { isBlocked });

    if (user) {
      await adminLogRepository.createLog({
        adminId,
        action: isBlocked ? "USER_BLOCKED" : "USER_UNBLOCKED",
        resource: "User",
        resourceId: id,
        metadata: { isBlocked },
      });
    }

    return user;
  }

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<UserStats> {
    return await adminUserRepository.getUserStats();
  }
}

export const adminUserService = new AdminUserService();


