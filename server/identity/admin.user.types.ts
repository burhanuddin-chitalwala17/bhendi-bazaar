import type { PlatformRole } from "@prisma/client";

/**
 * Admin User Management Domain Types
 */

/** The platform roles, declared once (closed sets are compared by constant). Mirrors the Prisma enum. */
export const PLATFORM_ROLE = {
  USER: "USER",
  ADMIN: "ADMIN",
} as const satisfies Record<PlatformRole, PlatformRole>;

export interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  mobile: string | null;
  platformRole: PlatformRole;
  isBlocked: boolean;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
  ordersCount?: number;
  totalSpent?: number;
}

export interface UserListFilters {
  search?: string; // Search by name, email, or mobile
  platformRole?: PlatformRole; // Filter by platform role
  isBlocked?: boolean; // Filter by blocked status
  page?: number;
  limit?: number;
  /**
   * `totalSpent` is deliberately absent: it is summed in JavaScript from each user's orders
   * (`admin.user.repository.ts`), so no `orderBy` can serve it — and sorting a page of already-
   * fetched rows would order the page rather than the result. It was declared here and reached
   * Prisma as an unknown argument until 2026-09-24; offering a sort that throws is worse than
   * not offering it. Serving it properly needs a denormalised column or a raw aggregate.
   */
  sortBy?: "createdAt" | "lastActiveAt";
  sortOrder?: "asc" | "desc";
}

export interface UserListResult {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UpdateUserInput {
  name?: string;
  platformRole?: PlatformRole;
  isBlocked?: boolean;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number; // Active in last 30 days
  blockedUsers: number;
  newUsersThisMonth: number;
}


