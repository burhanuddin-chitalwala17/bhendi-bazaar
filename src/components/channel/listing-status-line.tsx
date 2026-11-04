import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import type { ListingStatusDTO } from "@server/channels/platform-listing.types";

import { ago } from "./listing-copy";
import { statusText, statusTone } from "./platform-listing-copy";

/** Read when a time is shown, not as the component renders. */
const clock = () => Date.now();

const TONE = {
  success: "success",
  info: "info",
  muted: "neutral",
  destructive: "destructive",
  warning: "warning",
} as const;

/**
 * Where a listing stands, one pill (marketplace-publish ux.md status matrix): a dot and words, never
 * colour alone. Shared by the listing screen, the On marketplaces block and the Listings rows.
 */
export function ListingStatusLine({ status, label, className }: { status: ListingStatusDTO; label: string; className?: string }) {
  return (
    <StatusBadge tone={TONE[statusTone(status.status)]} dot className={className}>
      {statusText(status, label, (iso) => ago(iso, clock()))}
    </StatusBadge>
  );
}
