import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { CHANNEL_LABELS } from "@server/shared/channels";
import type { Channel } from "@server/shared/channels";

interface ChannelReadinessSummaryProps {
  orgId: string;
  rows: { channel: Channel; ready: number; warned: number; incomplete: number }[];
}

/**
 * How much of this catalogue each channel would take as it stands
 * ([channel-registry](../../../docs/specs/channel-registry/) R6, R7).
 *
 * A count rather than a column on the table: the list pages and refetches on the client, so a
 * per-row verdict would be blank on page two unless it travelled through a route handler — a
 * round trip for a read the server already does. This answers how much is left; the product
 * itself says what. Nothing here stops anybody publishing (D10).
 */
export function ChannelReadinessSummary({ orgId, rows }: ChannelReadinessSummaryProps) {
  if (rows.length === 0) return null;

  return (
    <Card className="py-4">
      <CardContent className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="text-sm font-medium">Ready to list elsewhere</p>
          <Link
            href={`/org/${orgId}/listing`}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Where you sell
          </Link>
        </div>
        <ul className="space-y-1">
          {rows.map((row) => {
            const total = row.ready + row.warned + row.incomplete;
            return (
              <li key={row.channel} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-medium">{CHANNEL_LABELS[row.channel]}</span>
                <span className="text-muted-foreground">
                  {row.ready + row.warned} of {total} would go
                  {row.incomplete > 0 && `, ${row.incomplete} missing something`}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
