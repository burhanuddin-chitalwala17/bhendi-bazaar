/** The policies page's heading (ADR-0067); the policies themselves are in support's copy. */
export const POLICIES_PAGE_COPY = {
  title: "Store policies",
  metaDescription: (app: string) => `Shipping, cancellation, returns, refunds, privacy and terms at ${app}.`,
  description: "How we ship, cancel, return and refund, and how we look after your data.",
} as const;
