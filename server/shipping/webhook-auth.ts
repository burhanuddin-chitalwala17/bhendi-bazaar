import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Whether a Shiprocket webhook carries the token configured in its dashboard (sent as `x-api-key`,
 * docs/INTEGRATIONS.md). Without this, anyone could post "delivered" and release a payout
 * (docs/GTM-READINESS.md B5). Fails closed: no token configured means nothing is trusted.
 */
export function isShiprocketWebhookAuthentic(
  presented: string | null,
  configured: string | undefined = process.env.SHIPROCKET_WEBHOOK_TOKEN,
): boolean {
  if (!configured || !presented) return false;
  // Hashed first so the comparison is constant-time whatever the lengths.
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(presented), digest(configured));
}
