/** The shop's Reviews page (ADR-0067). */
export const SHOP_REVIEWS_COPY = {
  title: "Reviews",
  description: "What buyers say about your products. Moderation is handled by the platform.",
  empty: "No reviews yet.",
  verified: "Verified purchase",
  withdrawn: "Withdrawn by the platform",
  pages: "Reviews pages",
  previous: "Previous",
  next: "Next",
  pageOf: (page: number, total: number) => `Page ${page} of ${total}`,
} as const;

export const PRODUCT_REVIEWS_COPY = {
  title: "Reviews",
  none: "No reviews yet. They appear after buyers receive orders.",
  failed: "Couldn't load. Try again.",
  tryAgain: "Try again",
  seeAll: "See all reviews",
  verified: "Verified purchase",
} as const;
