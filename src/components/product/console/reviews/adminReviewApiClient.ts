/**
 * The moderation queue's client (product-reviews R15, R16). No `deleteReview` — a review carries
 * attribution and is withdrawn, never destroyed (ADR-0032) — and no reads ([ADR-0034]).
 */

import { apiRequest } from "@/lib/api-client";
import type { AdminReview } from "@/domain/admin";

export const adminReviewApiClient = {
  /** Withdraw a review, or restore one. The only state moderation may write. */
  updateReview(id: string, data: { withdrawn: boolean }): Promise<AdminReview> {
    return apiRequest(`/api/admin/reviews/${id}`, { method: "PATCH", body: data });
  },
};
