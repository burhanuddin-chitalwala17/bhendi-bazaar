/**
 * Admin Review Management Domain Types
 */

export interface AdminReview {
  id: string;
  productId: string;
  productName?: string;
  userId: string | null;
  userName: string;
  rating: number;
  title: string | null;
  comment: string | null;
  isVerified: boolean;
  isApproved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewListFilters {
  search?: string; // Search by product name, user name, comment
  productId?: string;
  isApproved?: boolean;
  isVerified?: boolean;
  minRating?: number;
  maxRating?: number;
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "rating";
  sortOrder?: "asc" | "desc";
}

export interface ReviewListResult {
  reviews: AdminReview[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UpdateReviewInput {
  isApproved?: boolean;
  isVerified?: boolean;
}

export interface ReviewStats {
  totalReviews: number;
  pendingReviews: number;
  averageRating: number;
}


