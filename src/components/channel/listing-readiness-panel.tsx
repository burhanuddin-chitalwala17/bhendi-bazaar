import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CHANNEL_LABELS } from "@server/shared/channels";
import { LISTING_PROBLEM, LISTING_READINESS } from "@server/listing/channel-readiness";
import type { ChannelVerdict } from "@server/listing/channel-readiness.service";
import type { ListingProblem } from "@server/listing/channel-readiness";

interface ListingReadinessPanelProps {
  verdicts: ChannelVerdict[];
}

/**
 * How each channel this shop sells on would receive this product
 * ([channel-registry](../../../docs/specs/channel-registry/) R6, R7, D10).
 *
 * **It advises and never gates.** Nothing here disables anything, and publishing is not refused:
 * we have never watched a publish succeed, so our idea of what a channel requires is itself
 * untested, and a refusal built on it would stop listings that would have gone through. The
 * channel's own answer is the verdict; this is what we expect it to say.
 *
 * A shop selling nowhere else sees nothing at all, rather than a panel of warnings about places
 * it does not sell (spec A6).
 */
export function ListingReadinessPanel({ verdicts }: ListingReadinessPanelProps) {
  if (verdicts.length === 0) return null;

  return (
    <Card>
      <CardContent className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">How this would list elsewhere</h2>
          <p className="text-sm text-muted-foreground">
            What we expect each place to make of it. Nothing here stops you publishing — if a
            channel disagrees with us, it is the channel that is right.
          </p>
        </div>

        <ul className="space-y-4">
          {verdicts.map(({ channel, report }) => (
            <li key={channel} className="space-y-2 border-t pt-4 first:border-t-0 first:pt-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="font-medium">{CHANNEL_LABELS[channel]}</p>
                <BandLabel state={report.state} />
              </div>

              {report.theirCategory && (
                <p className="text-sm text-muted-foreground">
                  Listed under <span className="font-medium">{report.theirCategory}</span>
                </p>
              )}

              {report.problems.length > 0 && (
                <ul className="space-y-1">
                  {report.problems.map((problem, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span>{wordFor(problem)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function BandLabel({ state }: { state: ChannelVerdict["report"]["state"] }) {
  if (state === LISTING_READINESS.READY) {
    return (
      <span className="flex items-center gap-1.5 text-sm text-success">
        <CheckCircle2 className="size-4 shrink-0" aria-hidden />
        Nothing missing
      </span>
    );
  }
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 text-sm",
        state === LISTING_READINESS.INCOMPLETE ? "text-warning" : "text-muted-foreground",
      )}
    >
      <AlertTriangle className="size-4 shrink-0" aria-hidden />
      {state === LISTING_READINESS.INCOMPLETE ? "Something is missing" : "Worth a look"}
    </span>
  );
}

/**
 * Each problem in the shop's words rather than the schema's.
 *
 * A nearest fit reads as what it is — a decision somebody took — and says so every time rather
 * than once, which is the whole reason the fit is stored (D6, D12).
 */
function wordFor(problem: ListingProblem): string {
  switch (problem.problem) {
    case LISTING_PROBLEM.NO_CATEGORY:
      return "Nobody has chosen where this belongs on this channel yet.";
    case LISTING_PROBLEM.NEAREST_CATEGORY:
      return problem.note
        ? `This is the nearest they have, not their own word for it. ${problem.note}`
        : "This is the nearest category they have, not their own word for it.";
    case LISTING_PROBLEM.MISSING_FACT:
      return `They ask for ${problem.theirAttribute} and it is not answered.`;
    case LISTING_PROBLEM.MISSING_OPTIONAL_FACT:
      return `They would show ${problem.theirAttribute} if it were answered.`;
    case LISTING_PROBLEM.UNMAPPED_VALUE:
      return `They have no word for this ${problem.list} yet — "${problem.value}" needs one choosing, once, for every product that uses it.`;
  }
}
