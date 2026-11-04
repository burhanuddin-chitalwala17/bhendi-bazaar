/** The search page's words (ADR-0067). */
export const SEARCH_PAGE_COPY = {
  title: "Search",
  emptyDescription: "Use the search bar above to find ridas, abayas, shops and more.",
  promptTitle: "What are you looking for?",
  promptBody: "Type a word or two: a product, a colour, a shop.",
  browseShop: "Browse the shop",
  onOfferFilter: "On offer",
  eyebrow: "Search",
  query: (q: string) => `“${q}”`,
  emptyLabel: "results",
  noMatchTitle: (q: string) => `Nothing matches “${q}”`,
  noMatchBody: "Try a shorter word, another spelling, or browse by category.",
} as const;
