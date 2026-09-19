/**
 * Admin Reviews Page
 * Moderate and manage product reviews
 */

"use client";

import { useAsyncData } from "@/hooks/core/useAsyncData";
import { useMutation } from "@/hooks/core/useMutation";
import { useState } from "react";
import { toast } from "sonner";
import { DataTable, Column } from "@/components/shared/data-table";
import {
  Search,
  CheckCircle,
  XCircle,
  Trash2,
  Star,
  RefreshCw,
} from "lucide-react";
import { adminReviewApiClient } from "@/services/admin/reviewApiClient";
import type { AdminReview, ReviewListFilters } from "@/domain/admin";
import { DEFAULT_PAGE_SIZE } from "@server/shared/pagination";

import { PageHeader } from "@/components/shared/page-shell";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
export default function AdminReviewsPage() {
  const [filters, setFilters] = useState<ReviewListFilters>({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
  });
  const [searchTerm, setSearchTerm] = useState("");

  const {
    data,
    loading: isLoading,
    error,
    refetch,
  } = useAsyncData(() => adminReviewApiClient.getReviews(filters), {
    refetchDependencies: [filters],
  });

  const { reviews = [], totalPages = 1 } = data || {};

  const { mutate: updateReview, isLoading: isUpdating } = useMutation(
    ({
      id,
      data,
    }: {
      id: string;
      data: { isApproved?: boolean; isVerified?: boolean };
    }) => adminReviewApiClient.updateReview(id, data),
    {
      successMessage: "Review updated successfully!",
      onSuccess: () => refetch(),
    },
  );

  const { mutate: deleteReview, isLoading: isDeleting } = useMutation(
    adminReviewApiClient.deleteReview,
    {
      successMessage: "Review deleted successfully!",
      onSuccess: () => refetch(),
    },
  );

  const handleRefresh = () => {
    toast.info("Refreshing reviews...");
    refetch().then(() => toast.success("Reviews refreshed successfully!"));
  };

  const handleSearch = () => {
    setFilters({ ...filters, search: searchTerm, page: 1 });
  };

  const handleToggleApprove = (reviewId: string, isApproved: boolean) => {
    updateReview({ id: reviewId, data: { isApproved: !isApproved } }).then(() =>
      toast.success("Review updated successfully!"),
    );
  };

  const handleDelete = async (reviewId: string, userName: string) => {
    if (
      !confirm(
        `Are you sure you want to delete review by "${userName}"? This action cannot be undone.`,
      )
    ) {
      return;
    }
    deleteReview(reviewId).then(() =>
      toast.success("Review deleted successfully!"),
    );
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating
                ? "fill-warning text-warning"
                : "text-muted-foreground/50"
            }`}
          />
        ))}
      </div>
    );
  };

  const columns: Column<AdminReview>[] = [
    {
      key: "productName",
      label: "Product",
      render: (review) => (
        <div>
          <p className="font-medium text-sm">{review.productName}</p>
        </div>
      ),
    },
    {
      key: "userName",
      label: "Customer",
      render: (review) => (
        <div>
          <p className="font-medium">{review.userName}</p>
          {review.isVerified && (
            <span className="text-xs text-success">✓ Verified Purchase</span>
          )}
        </div>
      ),
    },
    {
      key: "rating",
      label: "Rating",
      sortable: true,
      render: (review) => (
        <div className="flex items-center gap-2">
          {renderStars(review.rating)}
          <span className="text-sm font-semibold">{review.rating}.0</span>
        </div>
      ),
    },
    {
      key: "review",
      label: "Review",
      render: (review) => (
        <div className="max-w-md">
          {review.title && (
            <p className="font-medium text-sm mb-1">{review.title}</p>
          )}
          {review.comment && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {review.comment}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "isApproved",
      label: "Status",
      render: (review) => (
        <Button
          variant="ghost"
          onClick={() => handleToggleApprove(review.id, review.isApproved)}
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            review.isApproved
              ? "bg-success/15 text-success hover:bg-success/25"
              : "bg-destructive/15 text-destructive hover:bg-destructive/25"
          }`}
        >
          {review.isApproved ? "Approved" : "Pending"}
        </Button>
      ),
    },
    {
      key: "createdAt",
      label: "Date",
      sortable: true,
      render: (review) => new Date(review.createdAt).toLocaleDateString(),
    },
    {
      key: "actions",
      label: "Actions",
      render: (review) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => handleToggleApprove(review.id, review.isApproved)}
            className={`p-2 rounded-lg transition-colors ${
              review.isApproved
                ? "text-warning hover:bg-warning/10"
                : "text-success hover:bg-success/10"
            }`}
            title={review.isApproved ? "Unapprove" : "Approve"}
          >
            {review.isApproved ? (
              <XCircle className="w-4 h-4" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(review.id, review.userName)}
            className="text-destructive hover:bg-destructive/10"
            title="Delete review"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reviews"
        description="Moderate and manage customer reviews"
        actions={
          <Button
            variant="default"
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
            />
            {isLoading ? "Refreshing..." : "Refresh"}
          </Button>
        }
      />

      {/* Filters */}
      <div className="bg-card rounded-lg border border-border p-4">
        <div className="flex flex-wrap gap-4">
          <div className="w-full min-w-0 grow sm:w-auto sm:min-w-64">
            <div className="flex gap-2">
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search by product, customer, or review..."
              />
              <Button
                variant="default"
                onClick={handleSearch}
                className="flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                Search
              </Button>
            </div>
          </div>

          <Select
            value={
              filters.isApproved === undefined
                ? "all"
                : filters.isApproved
                  ? "approved"
                  : "pending"
            }
            onChange={(e) =>
              setFilters({
                ...filters,
                isApproved:
                  e.target.value === "all"
                    ? undefined
                    : e.target.value === "approved",
                page: 1,
              })
            }
          >
            <option value="all">All Reviews</option>
            <option value="approved">Approved</option>
            <option value="pending">Pending</option>
          </Select>

          <Select
            value={
              filters.isVerified === undefined
                ? "all"
                : filters.isVerified
                  ? "verified"
                  : "unverified"
            }
            onChange={(e) =>
              setFilters({
                ...filters,
                isVerified:
                  e.target.value === "all"
                    ? undefined
                    : e.target.value === "verified",
                page: 1,
              })
            }
          >
            <option value="all">All Types</option>
            <option value="verified">Verified Purchase</option>
            <option value="unverified">Not Verified</option>
          </Select>

          <Select
            value={filters.minRating || "all"}
            onChange={(e) =>
              setFilters({
                ...filters,
                minRating:
                  e.target.value === "all"
                    ? undefined
                    : parseInt(e.target.value),
                page: 1,
              })
            }
          >
            <option value="all">All Ratings</option>
            <option value="5">5 Stars</option>
            <option value="4">4+ Stars</option>
            <option value="3">3+ Stars</option>
            <option value="2">2+ Stars</option>
            <option value="1">1+ Stars</option>
          </Select>
        </div>
      </div>

      {/* Reviews Table */}
      <DataTable
        data={reviews}
        columns={columns}
        totalPages={totalPages}
        currentPage={filters.page || 1}
        totalItems={data?.total || 0}
        pageSize={filters.limit ?? DEFAULT_PAGE_SIZE}
        onPageChange={(page) => setFilters({ ...filters, page })}
        onPageSizeChange={(limit) => setFilters({ ...filters, limit, page: 1 })}
        onSort={(key, order) =>
          setFilters({ ...filters, sortBy: key as any, sortOrder: order })
        }
        isLoading={isLoading}
      />
    </div>
  );
}
