/**
 * The admin console's reads of the `User` table. Read-only: the table's one writer is
 * `profile.repository.ts` (Invariant 5), which exposes `updateAdminFields` for the console.
 */

import { prisma } from "@server/shared/prisma";
import type { Prisma } from "@prisma/client";
import type {
  AdminUser,
  UserListFilters,
  UserStats,
} from "@server/identity/admin.user.types";

/** One projection for every console read and write, so a row cannot differ by path (ADR-0003 D3). */
export const ADMIN_USER_INCLUDE = {
  _count: {
    select: { orders: true },
  },
  orders: {
    select: {
      grandTotal: true,
    },
  },
} as const satisfies Prisma.UserInclude;

type AdminUserRow = Prisma.UserGetPayload<{ include: typeof ADMIN_USER_INCLUDE }>;

export function toAdminUser(user: AdminUserRow): AdminUser {
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
        relationLoadStrategy: "join",
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: ADMIN_USER_INCLUDE,
      }),
      prisma.user.count({ where }),
    ]);

    return { users: users.map(toAdminUser), total };
  }

  /**
   * Get single user by ID
   */
  async getUserById(id: string): Promise<AdminUser | null> {
    const user = await prisma.user.findUnique({
      relationLoadStrategy: "join",
      where: { id },
      include: ADMIN_USER_INCLUDE,
    });

    if (!user) return null;

    return toAdminUser(user);
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
