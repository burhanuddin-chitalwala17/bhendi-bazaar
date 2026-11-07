import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { CHANNEL_LABELS } from "@server/shared/channels";
import { LISTING_PROBLEM, LISTING_READINESS } from "@server/listing/channel-readiness";
import type { ChannelVerdict } from "@server/listing/channel-readiness.service";
import type { ListingProblem } from "@server/listing/channel-readiness";
import { READINESS_PANEL } from "./channel-copy";

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
          <h2 className="text-lg font-semibold">{READINESS_PANEL.title}</h2>
          <p className="text-sm text-muted-foreground">{READINESS_PANEL.intro}</p>
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
                  {READINESS_PANEL.listedUnder} <span className="font-medium">{report.theirCategory}</span>
                </p>
              )}

              {report.problems.length > 0 && (
                <ul className="space-y-1">
                  {report.problems.map((problem, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <Icon name="info" tone="muted" className="mt-0.5" />
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
        <Icon name="success" />
        {READINESS_PANEL.ready}
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
      <Icon name="warning" />
      {state === LISTING_READINESS.INCOMPLETE ? READINESS_PANEL.incomplete : READINESS_PANEL.worthALook}
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
      return READINESS_PANEL.noCategory;
    case LISTING_PROBLEM.NEAREST_CATEGORY:
      return problem.note
        ? READINESS_PANEL.nearestWithNote(problem.note)
        : READINESS_PANEL.nearest;
    case LISTING_PROBLEM.MISSING_FACT:
      return READINESS_PANEL.missingFact(problem.theirAttribute);
    case LISTING_PROBLEM.MISSING_OPTIONAL_FACT:
      return READINESS_PANEL.missingOptionalFact(problem.theirAttribute);
    case LISTING_PROBLEM.UNMAPPED_VALUE:
      return READINESS_PANEL.unmappedValue(problem.list, problem.value);
    case LISTING_PROBLEM.MISSING_FIELD:
      return READINESS_PANEL.missingField(problem.label);
  }
}
