/**
 * The moderation queue (product-reviews R15, R16).
 *
 * Two jobs the old table could not do. It could not *show* a review — the comment was
 * clamped to two lines with no way to open one, so moderating meant judging words you
 * could not read; a row now opens a detail panel with the whole review and its
 * photographs at a size they can be judged at. And it could not tell the three states
 * apart, because there was one boolean: a review is published, withdrawn by the
 * platform, or retracted by its author, and only the first two are ours to change
 * (ADR-0032).
 */

"use client";

import { useState } from "react";
import { toast } from "sonner";
import Image from "next/image";
import { Search, CheckCircle, XCircle, Star, RefreshCw } from "lucide-react";

import { useAsyncData } from "@/hooks/core/useAsyncData";
import { useMutation } from "@/hooks/core/useMutation";
import { DataTable, Column } from "@/components/shared/data-table";
import { adminReviewApiClient } from "@/services/admin/reviewApiClient";
import type { AdminReview, ReviewListFilters } from "@/domain/admin";
import { DEFAULT_PAGE_SIZE } from "@server/shared/pagination";

import { PageHeader } from "@/components/shared/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

/** The one place the three states are named, so the table and the panel cannot disagree. */
function stateOf(review: AdminReview) {
  if (review.deletedAt) {
    return {
      label: "Deleted by author",
      variant: "outline" as const,
      // The author's own act. Restoring it would republish words someone took back.
      moderable: false,
    };
  }
  if (review.withdrawnAt) {
    return { label: "Withdrawn", variant: "destructive" as const, moderable: true };
  }
  return { label: "Published", variant: "secondary" as const, moderable: true };
}

const Stars = ({ rating }: { rating: number }) => (
  <span className="flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
    {[1, 2, 3, 4, 5].map((star) => (
      <Star
        key={star}
        aria-hidden
        className={
          star <= rating
            ? "size-4 fill-warning text-warning"
            : "size-4 text-muted-foreground/50"
        }
      />
    ))}
  </span>
);

const Photos = ({ review, size }: { review: AdminReview; size: number }) => {
  const photos = review.media.filter((item) => item.kind === "IMAGE");
  if (photos.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {photos.map((item, index) => (
        <span
          key={item.ref}
          className="relative overflow-hidden rounded-card"
          style={{ width: size, height: size }}
        >
          <Image
            src={item.ref}
            alt={`Photo ${index + 1} on ${review.userName}'s review`}
            fill
            sizes={`${size}px`}
            className="object-cover"
          />
        </span>
      ))}
    </div>
  );
};

export default function AdminReviewsPage() {
  const [filters, setFilters] = useState<ReviewListFilters>({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [opened, setOpened] = useState<AdminReview | null>(null);

  const {
    data,
    loading: isLoading,
    refetch,
  } = useAsyncData(() => adminReviewApiClient.getReviews(filters), {
    refetchDependencies: [filters],
  });

  const { reviews = [], totalPages = 1 } = data || {};

  const { mutate: setWithdrawn } = useMutation(
    ({ id, withdrawn }: { id: string; withdrawn: boolean }) =>
      adminReviewApiClient.updateReview(id, { withdrawn }),
    {
      successMessage: "Review updated",
      onSuccess: () => {
        setOpened(null);
        refetch();
      },
    },
  );

  const handleRefresh = () => {
    refetch().then(() => toast.success("Reviews refreshed"));
  };

  const handleSearch = () => {
    setFilters({ ...filters, search: searchTerm || undefined, page: 1 });
  };

  const columns: Column<AdminReview>[] = [
    {
      key: "productName",
      label: "Product",
      render: (review) => (
        <p className="text-sm font-medium">{review.productName}</p>
      ),
    },
    {
      key: "userName",
      label: "Customer",
      render: (review) => (
        <div>
          <p className="font-medium">{review.userName}</p>
          {review.isVerified && (
            <span className="text-xs text-success">✓ Verified purchase</span>
          )}
        </div>
      ),
    },
    {
      key: "rating",
      label: "Rating",
      sortable: true,
      render: (review) => <Stars rating={review.rating} />,
    },
    {
      key: "review",
      label: "Review",
      render: (review) => (
        <div className="max-w-md space-y-1">
          {review.title && (
            <p className="text-sm font-medium">{review.title}</p>
          )}
          {review.comment && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {review.comment}
            </p>
          )}
          <Photos review={review} size={48} />
          {/* The clamp above is a preview, not the review. This is how you read it. */}
          <Button
            variant="ghost"
            className="h-auto p-0 text-xs underline"
            onClick={() => setOpened(review)}
          >
            Open review
          </Button>
        </div>
      ),
    },
    {
      key: "state",
      label: "Status",
      render: (review) => {
        const state = stateOf(review);
        return <Badge variant={state.variant}>{state.label}</Badge>;
      },
    },
    {
      key: "createdAt",
      label: "Date",
      sortable: true,
      render: (review) => new Date(review.createdAt).toLocaleDateString("en-IN"),
    },
    {
      key: "actions",
      label: "Actions",
      render: (review) => {
        const state = stateOf(review);
        if (!state.moderable) {
          // Nothing to offer: the author retracted it, and that is not ours to undo.
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        const withdrawn = review.withdrawnAt !== null;
        return (
          <Button
            variant="ghost"
            size="icon"
            title={withdrawn ? "Restore" : "Withdraw"}
            className={withdrawn ? "text-success" : "text-warning"}
            onClick={() => setWithdrawn({ id: review.id, withdrawn: !withdrawn })}
          >
            {withdrawn ? (
              <CheckCircle className="size-4" />
            ) : (
              <XCircle className="size-4" />
            )}
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reviews"
        description="Read, withdraw and restore customer reviews. Nothing here is deleted."
        actions={
          <Button
            variant="default"
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={isLoading ? "size-4 animate-spin" : "size-4"} />
            {isLoading ? "Refreshing…" : "Refresh"}
          </Button>
        }
      />

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap gap-4">
          <div className="w-full min-w-0 grow sm:w-auto sm:min-w-64">
            <div className="flex gap-2">
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search by product, customer, or review…"
              />
              <Button
                variant="default"
                onClick={handleSearch}
                className="flex items-center gap-2"
              >
                <Search className="size-4" />
                Search
              </Button>
            </div>
          </div>

          <Select
            value={filters.state ?? "all"}
            onChange={(e) =>
              setFilters({
                ...filters,
                state:
                  e.target.value === "all"
                    ? undefined
                    : (e.target.value as ReviewListFilters["state"]),
                page: 1,
              })
            }
          >
            <option value="all">All reviews</option>
            <option value="published">Published</option>
            <option value="withdrawn">Withdrawn</option>
            <option value="deleted">Deleted by author</option>
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
            <option value="all">All types</option>
            <option value="verified">Verified purchase</option>
            <option value="unverified">Not verified</option>
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
            <option value="all">All ratings</option>
            <option value="5">5 stars</option>
            <option value="4">4+ stars</option>
            <option value="3">3+ stars</option>
            <option value="2">2+ stars</option>
            <option value="1">1+ stars</option>
          </Select>
        </div>
      </div>

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
          setFilters({
            ...filters,
            sortBy: key === "rating" ? "rating" : "createdAt",
            sortOrder: order,
          })
        }
        isLoading={isLoading}
      />

      {/* The review itself, in full. A queue that cannot show one cannot moderate. */}
      <Dialog
        open={opened !== null}
        onOpenChange={(open) => !open && setOpened(null)}
      >
        <DialogContent className="max-h-overlay overflow-y-auto">
          {opened && (
            <>
              <DialogHeader>
                <DialogTitle>{opened.title || "Review"}</DialogTitle>
                <DialogDescription>
                  {opened.userName} on {opened.productName} ·{" "}
                  {new Date(opened.createdAt).toLocaleDateString("en-IN")}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Stars rating={opened.rating} />
                  <Badge variant={stateOf(opened).variant}>
                    {stateOf(opened).label}
                  </Badge>
                  {opened.isVerified && (
                    <Badge variant="secondary">Verified purchase</Badge>
                  )}
                </div>

                <p className="whitespace-pre-wrap text-sm">
                  {opened.comment || (
                    <span className="text-muted-foreground">
                      No words — a rating only.
                    </span>
                  )}
                </p>

                <Photos review={opened} size={112} />

                {opened.deletedAt && (
                  <p className="text-xs text-muted-foreground">
                    The author deleted this on{" "}
                    {new Date(opened.deletedAt).toLocaleDateString("en-IN")}. It
                    is kept here and shown to nobody else.
                  </p>
                )}
              </div>

              <DialogFooter>
                {stateOf(opened).moderable && (
                  <Button
                    variant={opened.withdrawnAt ? "default" : "destructive"}
                    onClick={() =>
                      setWithdrawn({
                        id: opened.id,
                        withdrawn: opened.withdrawnAt === null,
                      })
                    }
                  >
                    {opened.withdrawnAt ? "Restore review" : "Withdraw review"}
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setOpened(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
