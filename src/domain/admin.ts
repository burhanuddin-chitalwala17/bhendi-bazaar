/**
 * Client-side Admin Domain Types
 * Simplified types for admin frontend
 */

// Re-export server types for client use
export type {
  DashboardStats,
  RecentActivity,
  RevenueChart,
} from "@server/analytics/dashboard.types";

export type {
  AdminUser,
  UserListFilters,
  UserListResult,
} from "@server/identity/admin.user.types";

export type {
  OrderListFilters,
  OrderListResult,
} from "@server/checkout/admin.order.types";

export type {
  AdminCategory,
  CategoryListFilters,
  CategoryListResult,
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@server/catalog/admin.category.types";

export type {
  AdminReview,
  ReviewListFilters,
  ReviewListResult,
} from "@server/catalog/review.types";

export type {
  AbandonedCart,
  AbandonedCartFilters,
  AbandonedCartResult,
} from "@server/cart/admin.cart.types";


