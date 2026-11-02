import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { CHANNEL_LABELS } from "@server/shared/channels";
import type { ChannelSummaryRow } from "@server/listing/channel-readiness.service";

import { AskAdminPicker } from "./ask-admin-picker";
import { FIX } from "./readiness-fix-copy";

const GAPS_SHOWN = 3;

/**
 * How much of this catalogue each channel would take as it stands, and what keeps the rest off
 * ([channel-registry](../../../docs/specs/channel-registry/) R6, R7; readiness-fix R1): each missing
 * compulsory fact with its count and "Fix them", and a type with no category there with "Ask the
 * admin". A count, not a column: the product itself says what. Nothing here stops publishing (D10).
 */
export function ChannelReadinessSummary({ orgId, rows }: { orgId: string; rows: ChannelSummaryRow[] }) {
  if (rows.length === 0) return null;

  return (
    <Card className="py-4">
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-sm font-medium">Ready to list elsewhere</p>
          <Link href={`/org/${orgId}/channels`} className="text-sm text-primary underline-offset-4 hover:underline">
            Where you sell
          </Link>
        </div>
        <ul className="space-y-3">
          {rows.map((row) => {
            const total = row.ready + row.warned + row.incomplete;
            const label = CHANNEL_LABELS[row.channel];
            return (
              <li key={row.channel} className="space-y-1 text-sm">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{label}</span>
                  <span className="text-muted-foreground">
                    {row.ready + row.warned} of {total} would go
                  </span>
                </p>
                {(row.gaps.length > 0 || row.noCategory > 0) && (
                  <ul className="space-y-1 pl-3">
                    {row.gaps.slice(0, GAPS_SHOWN).map((gap) => (
                      <Gap key={gap.fact} orgId={orgId} channel={row.channel} gap={gap} />
                    ))}
                    {row.gaps.length > GAPS_SHOWN && (
                      <li>
                        <details>
                          <summary className="inline-flex min-h-10 cursor-pointer items-center text-muted-foreground md:min-h-0">{FIX.more(row.gaps.length - GAPS_SHOWN)}</summary>
                          <ul className="space-y-1">
                            {row.gaps.slice(GAPS_SHOWN).map((gap) => (
                              <Gap key={gap.fact} orgId={orgId} channel={row.channel} gap={gap} />
                            ))}
                          </ul>
                        </details>
                      </li>
                    )}
                    {row.noCategory > 0 && (
                      <li className="flex flex-wrap items-center gap-x-3 text-muted-foreground">
                        <span>{FIX.noCategory(row.noCategory, label)}</span>
                        <AskAdminPicker message={`${row.noCategory} of my products have no ${label} category. Please map their product type for ${label}.`} />
                      </li>
                    )}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function Gap({ orgId, channel, gap }: { orgId: string; channel: ChannelSummaryRow["channel"]; gap: ChannelSummaryRow["gaps"][number] }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 text-muted-foreground">
      <span>{FIX.need(gap.count, gap.label)}</span>
      {gap.fixable && (
        <Link
          href={`/org/${orgId}/products/fix?channel=${channel}&fact=${gap.fact}`}
          className="inline-flex min-h-10 items-center font-medium text-primary underline-offset-4 hover:underline md:min-h-0"
        >
          {FIX.fixThem}
        </Link>
      )}
    </li>
  );
}
