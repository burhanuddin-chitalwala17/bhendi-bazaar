"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";
import { CheckCircle, XCircle } from "lucide-react";

import { DataTable, Column } from "@/components/shared/data-table";
import { useMutation } from "@/hooks/core/useMutation";
import { adminReviewApiClient } from "@/components/product/console/reviews/adminReviewApiClient";
import { ReviewMedia } from "@/components/product/review-media";
import type { AdminReview } from "@/domain/admin";
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
import { Stars, stateOf } from "./review-state";
import { formatShortDate } from "@/lib/format";

interface Props {
  reviews: AdminReview[];
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
}

/**
 * The moderation queue's rows, the full-review dialog, and the withdraw/restore action.
 *
 * Paging and sorting navigate rather than refetch — the page above is a server component
 * ([ADR-0034]). `router.refresh()` after moderating re-runs that read.
 */
export function ReviewsTable({ reviews, page, pageSize, totalPages, total }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [opened, setOpened] = useState<AdminReview | null>(null);

  const go = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.push(`${pathname}?${next.toString()}`);
  };

  const { mutate: setWithdrawn } = useMutation(
    ({ id, withdrawn }: { id: string; withdrawn: boolean }) =>
      adminReviewApiClient.updateReview(id, { withdrawn }),
    {
      successMessage: "Review updated",
      onSuccess: () => {
        setOpened(null);
        router.refresh();
      },
    },
  );

  const columns: Column<AdminReview>[] = [
    {
      key: "productName",
      label: "Product",
      render: (review) => <p className="text-sm font-medium">{review.productName}</p>,
    },
    {
      key: "userName",
      label: "Customer",
      render: (review) => (
        <div>
          <p className="font-medium">{review.userName}</p>
          {review.isVerified && <span className="text-xs text-success">✓ Verified purchase</span>}
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
          {review.title && <p className="text-sm font-medium">{review.title}</p>}
          {review.comment && (
            <p className="line-clamp-2 text-sm text-muted-foreground">{review.comment}</p>
          )}
          {/* The same viewer the buyer gets: a moderator deciding whether a picture may stay has
              to be able to look at it properly. */}
          <ReviewMedia media={review.media} authorName={review.userName} size="sm" />
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
      render: (review) => formatShortDate(review.createdAt),
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
            {withdrawn ? <CheckCircle className="size-4" /> : <XCircle className="size-4" />}
          </Button>
        );
      },
    },
  ];

  return (
    <>
      <DataTable
        data={reviews}
        columns={columns}
        totalPages={totalPages}
        currentPage={page}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={(next) => go({ page: String(next) })}
        onPageSizeChange={(limit) => go({ limit: String(limit), page: "" })}
        onSort={(key, order) => go({ sortBy: key, sortOrder: order })}
      />

      {/* The review itself, in full. A queue that cannot show one cannot moderate. */}
      <Dialog open={opened !== null} onOpenChange={(open) => !open && setOpened(null)}>
        <DialogContent className="max-h-overlay overflow-y-auto">
          {opened && (
            <>
              <DialogHeader>
                <DialogTitle>{opened.title || "Review"}</DialogTitle>
                <DialogDescription>
                  {opened.userName} on {opened.productName} ·{" "}
                  {formatShortDate(opened.createdAt)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Stars rating={opened.rating} />
                  <Badge variant={stateOf(opened).variant}>{stateOf(opened).label}</Badge>
                  {opened.isVerified && <Badge variant="secondary">Verified purchase</Badge>}
                </div>

                <p className="whitespace-pre-wrap text-sm">
                  {opened.comment || (
                    <span className="text-muted-foreground">No words — a rating only.</span>
                  )}
                </p>

                <ReviewMedia media={opened.media} authorName={opened.userName} size="lg" />

                {opened.deletedAt && (
                  <p className="text-xs text-muted-foreground">
                    The author deleted this on{" "}
                    {formatShortDate(opened.deletedAt)}. It is kept here and
                    shown to nobody else.
                  </p>
                )}
              </div>

              <DialogFooter>
                {stateOf(opened).moderable && (
                  <Button
                    variant={opened.withdrawnAt ? "default" : "destructive"}
                    onClick={() =>
                      setWithdrawn({ id: opened.id, withdrawn: opened.withdrawnAt === null })
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
    </>
  );
}
