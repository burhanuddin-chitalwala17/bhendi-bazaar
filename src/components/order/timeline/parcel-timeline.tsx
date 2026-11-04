import type { ParcelTimelineDto } from "@server/checkout/parcel-timeline";
import { timelineLine, type TimelineReader } from "./timeline-copy";
import { PARCEL_TIMELINE_COPY } from "./timeline-copy";

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
  const entries = [...timeline.entries]
    .reverse()
    .map((entry) => ({ entry, line: timelineLine(reader, entry, timeline) }))
    .filter((row): row is { entry: typeof row.entry; line: string } => row.line !== null);
  if (entries.length === 0) return null;
  return (
    <ol className="space-y-2 border-l pl-4 text-sm" aria-label={PARCEL_TIMELINE_COPY.parcelTimeline}>
      {entries.map(({ entry, line }) => (
        <li key={`${entry.at}-${entry.kind}-${entry.status}`}>
          <p className="break-words">{line}</p>
          <p className="text-xs text-muted-foreground">
            {entry.day}, {entry.time}
          </p>
        </li>
      ))}
    </ol>
  );
}
