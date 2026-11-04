/** Words for types/ (ADR-0067): kept byte-identical to what they showed. */

/** product.ts: each product flag as the console names and explains it. */
export const PRODUCT_FLAG_COPY = {
  featured: { label: "Featured Product", description: "Display this product in featured sections" },
  hero: { label: "Hero Product", description: "Display this product in hero sections on homepage" },
  onOffer: { label: "On Offer", description: "Derived from active promotions" },
  newArrival: { label: "New Arrival", description: (days: number) => `Derived from creation date (${days} days)` },
  clearance: { label: "Clearance Sale", description: "Mark this product as part of clearance sale" },
} as const;
