/**
 * The key our order id travels under in Razorpay's `notes` — written at gateway-order
 * creation, read back by the webhook. A string contract with an external service that
 * the compiler cannot check: creation once wrote `orderId` while the webhook read
 * `localOrderId`, and every webhook silently no-op'd (and returned 200). One constant,
 * both sides, and a test that pins it (trd.md D6).
 */
export const RAZORPAY_NOTES_ORDER_KEY = "localOrderId" as const;
