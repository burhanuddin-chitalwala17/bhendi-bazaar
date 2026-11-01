import type { ParcelTimelineDto } from "@server/checkout/parcel-timeline";
import { timelineLine, type TimelineReader } from "./timeline-copy";

/**
 * A parcel's timeline (order-fulfilment R7, D5): the same events for shop, buyer and admin, worded
 * per reader, every date in India time. Newest first, so the parcel's state reads at the top.
 */
export function ParcelTimeline({
  timeline,
  reader,
}: {
  timeline: ParcelTimelineDto | undefined;
  reader: TimelineReader;
}) {
  if (!timeline || timeline.entries.length === 0) return null;
  const entries = [...timeline.entries].reverse();
  return (
    <ol className="space-y-2 border-l pl-4 text-sm" aria-label="Parcel timeline">
      {entries.map((entry) => (
        <li key={`${entry.at}-${entry.kind}-${entry.status}`}>
          <p className="break-words">{timelineLine(reader, entry, timeline)}</p>
          <p className="text-xs text-muted-foreground">
            {entry.day}, {entry.time}
          </p>
        </li>
      ))}
    </ol>
  );
}
