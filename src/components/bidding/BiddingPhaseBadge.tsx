import { Badge } from "@/components/ui/badge";
import type { BiddingPhase } from "@server/bidding/bidding-window";
import { BIDDING_PHASE_BADGE_COPY } from "./bidding-copy";

/**
 * One chip, one vocabulary. The phase is derived from the clock on every read, so this
 * is the only place the derived value becomes words a person sees — otherwise "ended"
 * and "closed" and "finished" drift apart across three screens.
 */
const LABELS: Record<
  BiddingPhase,
  { text: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  SCHEDULED: { text: BIDDING_PHASE_BADGE_COPY.startsSoon, variant: "outline" },
  LIVE: { text: BIDDING_PHASE_BADGE_COPY.live, variant: "default" },
  ENDED: { text: BIDDING_PHASE_BADGE_COPY.awaitingOutcome, variant: "secondary" },
  SOLD: { text: BIDDING_PHASE_BADGE_COPY.sold, variant: "secondary" },
  UNSOLD: { text: BIDDING_PHASE_BADGE_COPY.unsold, variant: "outline" },
  CANCELLED: { text: BIDDING_PHASE_BADGE_COPY.cancelled, variant: "destructive" },
};

export function BiddingPhaseBadge({ phase }: { phase: BiddingPhase }) {
  const { text, variant } = LABELS[phase];
  return (
    <Badge
      variant={variant}
      className="text-2xs uppercase tracking-label sm:text-2xs"
    >
      {text}
    </Badge>
  );
}
