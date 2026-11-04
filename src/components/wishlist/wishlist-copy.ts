/** The Saved tab's words (ADR-0067). */
export const WISHLIST_COPY = {
  title: "Saved",
  emptyTitle: "Nothing saved yet",
  emptyBody: "Tap the heart on anything to keep it here for later.",
  startBrowsing: "Start browsing",
  soldOut: "Sold out",
  signInTitle: "Sign in to see what you saved",
  signInBody: "Things you save with the heart are kept on your account, on every device.",
  count: (n: number) => `${n} saved ${n === 1 ? "item" : "items"}`,
} as const;

export const WISHLIST_BUTTON_LABEL_COPY = {
  remove: "Remove from wishlist",
  add: "Add to wishlist",
} as const;
