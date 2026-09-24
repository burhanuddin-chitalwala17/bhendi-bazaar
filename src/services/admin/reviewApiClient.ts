/**
 * The moderation queue's client (product-reviews R15, R16).
 *
 * One method, because moderation writes one thing. There is no `deleteReview` — a review
 * carries attribution and is never destroyed, the platform withdraws it and keeps it readable
 * (ADR-0032) — and no reads: the queue and its detail panel are rendered from a server
 * component's own read ([ADR-0034]), so both `getReviews` and `getReview` were round trips for
 * data the page already held.
 */

import type { AdminReview } from "@/domain/admin";
import { readApiError } from "@/lib/api-error";

class AdminReviewService {
  /** Withdraw a review, or restore one. The only state moderation may write. */
  async updateReview(id: string, data: { withdrawn: boolean }): Promise<AdminReview> {
    const response = await fetch(`/api/admin/reviews/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) throw await readApiError(response);
    return response.json();
  }
}

export const adminReviewApiClient = new AdminReviewService();
