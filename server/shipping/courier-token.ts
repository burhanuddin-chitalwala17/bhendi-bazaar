import { createHash, timingSafeEqual } from "node:crypto";

/** Where Shiprocket puts the token set beside the webhook URL in its dashboard (INTEGRATIONS.md). */
export const COURIER_TOKEN_HEADER = "x-api-key";

const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();

/**
 * Whether a courier update carries our shared token (order-fulfilment D9, A4). Digests first, so
 * the comparison is constant-time whatever the lengths; no secret configured refuses everything.
 */
export function isCourierTokenValid(presented: string | null, secret: string | undefined = process.env.SHIPPING_WEBHOOK_TOKEN): boolean {
  if (!secret || !presented) return false;
  return timingSafeEqual(digest(presented), digest(secret));
}
