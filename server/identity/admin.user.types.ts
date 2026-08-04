/**
 * Admin User Management Domain Types
 */

export interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  mobile: string | null;
  role: string;
  isBlocked: boolean;
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
  ordersCount?: number;
  totalSpent?: number;
}

export interface UserListFilters {
  search?: string; // Search by name, email, or mobile
  role?: string; // Filter by role
  isBlocked?: boolean; // Filter by blocked status
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "lastActiveAt" | "totalSpent";
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
  role?: string;
  isBlocked?: boolean;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number; // Active in last 30 days
  blockedUsers: number;
  newUsersThisMonth: number;
}


