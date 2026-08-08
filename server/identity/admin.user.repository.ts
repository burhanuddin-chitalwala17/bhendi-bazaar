/**
 * Admin User Repository
 * Handles database operations for user management
 */

import { prisma } from "@server/shared/prisma";
import type {
  AdminUser,
  UserListFilters,
  UpdateUserInput,
  UserStats,
} from "@server/identity/admin.user.types";

export class AdminUserRepository {
  /**
   * Get paginated list of users with filters
   */
  async getUsers(filters: UserListFilters) {
    const {
      search,
      platformRole,
      isBlocked,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = filters;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { mobile: { contains: search, mode: "insensitive" } },
      ];
    }

    if (platformRole) {
      where.platformRole = platformRole;
    }

    if (typeof isBlocked === "boolean") {
      where.isBlocked = isBlocked;
    }

    // Get users with order aggregation
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: { orders: true },
          },
          orders: {
            select: {
              grandTotal: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    // Transform to AdminUser format
    const adminUsers: AdminUser[] = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      platformRole: user.platformRole,
      isBlocked: user.isBlocked,
      lastActiveAt: user.lastActiveAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      ordersCount: user._count.orders,
      totalSpent: user.orders.reduce((sum, order) => {
        const grandTotal = order.grandTotal || 0;
        return sum + (grandTotal || 0);
      }, 0),
    }));

    return { users: adminUsers, total };
  }

  /**
   * Get single user by ID
   */
  async getUserById(id: string): Promise<AdminUser | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: { orders: true },
        },
        orders: {
          select: {
            grandTotal: true,
          },
        },
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      platformRole: user.platformRole,
      isBlocked: user.isBlocked,
      lastActiveAt: user.lastActiveAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      ordersCount: user._count.orders,
      totalSpent: user.orders.reduce((sum, order) => {
        const grandTotal = order.grandTotal || 0;
        return sum + grandTotal;
      }, 0),
    };
  }

  /**
   * Update user
   */
  async updateUser(
    id: string,
    data: UpdateUserInput
  ): Promise<AdminUser | null> {
    const updated = await prisma.user.update({
      where: { id },
      data,
      include: {
        _count: {
          select: { orders: true },
        },
        orders: {
          select: {
            grandTotal: true,
          },
        },
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      mobile: updated.mobile,
      platformRole: updated.platformRole,
      isBlocked: updated.isBlocked,
      lastActiveAt: updated.lastActiveAt,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      ordersCount: updated._count.orders,
      totalSpent: updated.orders.reduce((sum, order) => {
        const grandTotal = order.grandTotal || 0;
        return sum + grandTotal;
      }, 0),
    };
  }

  /**
   * Get user statistics
   */
  async getUserStats(): Promise<UserStats> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [totalUsers, activeUsers, blockedUsers, newUsersThisMonth] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({
          where: {
            lastActiveAt: {
              gte: thirtyDaysAgo,
            },
          },
        }),
        prisma.user.count({
          where: {
            isBlocked: true,
          },
        }),
        prisma.user.count({
          where: {
            createdAt: {
              gte: startOfMonth,
            },
          },
        }),
      ]);

    return {
      totalUsers,
      activeUsers,
      blockedUsers,
      newUsersThisMonth,
    };
  }
}

export const adminUserRepository = new AdminUserRepository();


