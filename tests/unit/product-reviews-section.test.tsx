/**
 * Reviews read where they matter (seller-onboarding U5; R9, D12): the product's Reviews section is
 * read-only and fails alone with its own retry. Home's "new reviews" line left under design-system
 * Q31 (nothing a shop does clears it), so its landing tests went with it.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReviewDto, ReviewPageDto } from "@server/catalog/review.types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const { ProductReviewsSection } = await import("@/components/org/product-reviews-section");

const review = (id: string, comment: string, isMine = false): ReviewDto => ({
  id,
  rating: 4,
  title: null,
  comment,
  authorName: "Buyer",
  isVerifiedPurchase: true,
  createdAt: "2026-10-30T10:00:00.000Z",
  isMine,
  media: [],
});

const page = (reviews: ReviewDto[], hasMore = false): ReviewPageDto => ({
  reviews,
  summary: { average: 4, count: reviews.length, histogram: { 1: 0, 2: 0, 3: 0, 4: reviews.length, 5: 0 } },
  total: reviews.length,
  hasMore,
});

describe("reviews on the portal product page (R9)", () => {
  it("shows reviews newest first as given, read-only even for the shop's own account", () => {
    render(<ProductReviewsSection read={{ ok: true, page: page([review("r2", "Newer", true), review("r1", "Older")], true) }} allReviewsHref="/org/o1/reviews" />);
    const comments = screen.getAllByText(/Newer|Older/).map((node) => node.textContent);
    expect(comments).toEqual(["Newer", "Older"]);
    expect(screen.queryByRole("button", { name: /edit|delete/i })).toBeNull();
    expect(screen.getByRole("link", { name: "See all reviews" })).toHaveAttribute("href", "/org/o1/reviews");
  });

  it("says when there are none yet, in ux.md's words", () => {
    render(<ProductReviewsSection read={{ ok: true, page: page([]) }} allReviewsHref="/org/o1/reviews" />);
    expect(screen.getByText("No reviews yet. They appear after buyers receive orders.")).toBeInTheDocument();
  });

  it("fails alone, with its own Try again", () => {
    render(<ProductReviewsSection read={{ ok: false }} allReviewsHref="/org/o1/reviews" />);
    expect(screen.getByText("Couldn't load. Try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
