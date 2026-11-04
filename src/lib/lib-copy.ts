/** Words for lib/ (ADR-0067): one object per component file, kept byte-identical to what it showed. */

/** auth-intent.ts */
export const AUTH_INTENT_COPY = {
  addedToWishlist: "Added to wishlist",
} as const;

/** api-error-response.ts: the envelope's fallback words (docs/CONTRACTS.md). */
export const ERROR_RESPONSE_COPY = {
  somethingWentWrong: "Something went wrong",
  correctHighlighted: "Please correct the highlighted fields",
  valueInUse: "That value is already in use",
  fieldInUse: (field: string) => `This ${field} is already in use`,
  valuesInUse: "Some values are already in use",
  cannotDeleteReferredBy: (referrer: string) => `This cannot be deleted while ${referrer} still refer to it`,
  cannotDeleteReferred: "This cannot be deleted while other records still refer to it",
  fieldGone: (field: string) => `That ${field} no longer exists — pick another`,
  fieldTooLong: (field: string) => `This ${field} is too long`,
  fieldRequired: (field: string) => `This ${field} is required`,
  recordsGone: "One of the selected records no longer exists",
  valuesRejected: "Some values were rejected",
  recordGone: "That record no longer exists",
} as const;

/** api-error-response.ts: a column's name as a person reads it. */
export const FIELD_LABEL_COPY: Record<string, string> = {
  sku: "SKU",
  slug: "URL slug",
  email: "email address",
  mobile: "mobile number",
  code: "code",
  gstNumber: "GST number",
  categoryId: "category",
  orgId: "org",
};

/** api-error-response.ts: what a table's rows are, for a delete a Restrict foreign key refused. */
export const REFERENCED_BY_COPY: Record<string, string> = {
  OrderItem: "existing orders",
  OrderDiscount: "recorded discounts",
  OrgLedgerEntry: "payout records",
  PromotionTarget: "promotions",
  BiddingEvent: "bidding events",
  Shipment: "shipments",
  Product: "products",
};

/** api-client.ts: a request that never answered. */
export const API_CLIENT_COPY = {
  offline: "You seem to be offline. Check your connection and try again.",
  timeout: "This is taking too long. Check your connection and try again.",
  timeoutUnsure: "This is taking too long, and it may still go through. Refresh to check before trying again.",
} as const;

/** auth-intent.ts: a resumed action that failed without its own words. */
export const AUTH_INTENT_FAILED_COPY = {
  didNotGoThrough: "That did not go through. Please try again.",
} as const;

/** banner-label.ts */
export const BANNER_LABEL_COPY = {
  untitled: "Untitled banner",
} as const;

/** product-paging.ts: the sort choices' labels. */
export const PRODUCT_SORT_COPY = {
  newest: "New arrivals",
  priceAsc: "Price: low to high",
  priceDesc: "Price: high to low",
} as const;

/** date-range.ts */
export const DATE_RANGE_COPY = {
  from: (day: string) => `From ${day}`,
  until: (day: string) => `Until ${day}`,
  anyTime: "Any time",
  last7: "Last 7 days",
  last30: "Last 30 days",
  thisMonth: "This month",
  lastMonth: "Last month",
} as const;

/** image/upload-batch.ts */
export const UPLOAD_BATCH_COPY = {
  failed: "Upload failed",
} as const;
