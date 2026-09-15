import { Badge } from "@/components/ui/badge";
import type { BiddingPhase } from "@server/bidding/bidding-window";

/**
 * One chip, one vocabulary. The phase is derived from the clock on every read, so this
 * is the only place the derived value becomes words a person sees — otherwise "ended"
 * and "closed" and "finished" drift apart across three screens.
 */
const LABELS: Record<BiddingPhase, { text: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  SCHEDULED: { text: "Starts soon", variant: "outline" },
  LIVE: { text: "Live", variant: "default" },
  ENDED: { text: "Awaiting outcome", variant: "secondary" },
  SOLD: { text: "Sold", variant: "secondary" },
  UNSOLD: { text: "Unsold", variant: "outline" },
  CANCELLED: { text: "Cancelled", variant: "destructive" },
};

export function BiddingPhaseBadge({ phase }: { phase: BiddingPhase }) {
  const { text, variant } = LABELS[phase];
  return (
    <Badge variant={variant} className="text-4xs uppercase tracking-label sm:text-3xs">
      {text}
    </Badge>
  );
}
