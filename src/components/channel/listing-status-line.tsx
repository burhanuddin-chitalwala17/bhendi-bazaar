import { cn } from "@/lib/utils";
import type { ListingStatusDTO } from "@server/channels/platform-listing.types";

import { ago } from "./listing-copy";
import { statusText, statusTone } from "./platform-listing-copy";

/** Read when a time is shown, not as the component renders. */
const clock = () => Date.now();

const TONE = {
  success: "bg-success/10 text-success",
  info: "bg-info/10 text-info",
  muted: "bg-muted text-muted-foreground",
  destructive: "bg-destructive/10 text-destructive",
  warning: "bg-warning/10 text-warning",
} as const;

/**
 * Where a listing stands, one pill (marketplace-publish ux.md status matrix): a dot and words, never
 * colour alone. Shared by the listing screen, the On marketplaces block and the Listings rows.
 */
export function ListingStatusLine({ status, label, className }: { status: ListingStatusDTO; label: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", TONE[statusTone(status.status)], className)}>
      <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden />
      {statusText(status, label, (iso) => ago(iso, clock()))}
    </span>
  );
}
