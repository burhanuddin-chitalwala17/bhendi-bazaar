/**
 * Reviews read where they matter (seller-onboarding U5; R9, D12; Q13): Home's "new reviews" line
 * lands on the product's Reviews section, which is read-only and fails alone with its own retry.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { HomeAttentionDto } from "@/data-access-layer/org/home.dal";
import type { ReviewDto, ReviewPageDto } from "@server/catalog/review.types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const { ProductReviewsSection } = await import("@/components/org/product-reviews-section");
const { attentionLines } = await import("@/components/org/home/attention-lines");

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

const none = { ok: true as const, value: 0 };
const attention = (productId: string | null): HomeAttentionDto => ({
  parcels: none,
  reviews: { ok: true, value: { count: 2, productId } },
  channel: { ok: true, value: null },
  photos: none,
  auction: { ok: true, value: null },
  teamEdits: { ok: true, value: { count: 0, productId: null } },
});

describe("reviews on the portal product page (R9)", () => {
  it("is where Home's line lands when the new reviews share one product (Q13)", () => {
    const [line] = attentionLines("o1", attention("p1"), new Date());
    expect(line.ok && line.href).toMatch(/^\/org\/o1\/products\/p1#/);
    const { container } = render(<ProductReviewsSection read={{ ok: true, page: page([review("r1", "Lovely")]) }} allReviewsHref="/org/o1/reviews" />);
    const anchor = (line.ok ? line.href : "").split("#")[1];
    expect(container.querySelector(`#${anchor}`)).not.toBeNull();
  });

  it("goes to the Reviews page when the new reviews span products", () => {
    const [line] = attentionLines("o1", attention(null), new Date());
    expect(line.ok && line.href).toBe("/org/o1/reviews");
  });

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
