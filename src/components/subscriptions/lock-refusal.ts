import { ApiError } from "@/lib/api-error";
import { isFeature, type Feature } from "@server/subscriptions/feature-access.types";

/**
 * The feature a refused call names, when a lock landed while the screen was open (feature-access
 * ux.md "Stale", D4): the caller opens the locked sheet instead of an error toast.
 */
export function lockedFeatureOf(error: unknown): Feature | null {
  if (!(error instanceof ApiError) || error.status !== 403) return null;
  const detail = error.details.find((d) => d.path === "feature");
  return detail && isFeature(detail.message) ? detail.message : null;
}
