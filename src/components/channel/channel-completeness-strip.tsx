import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { CHANNEL_LABELS, type Channel } from "@server/shared/channels";
import { COMPLETENESS_COPY } from "./channel-copy";

interface ChannelCompletenessStripProps {
  states: ReadonlyArray<{ channel: string; required: number; missing: number; missingKeys: string[] }>;
}

/**
 * Under a product's title: how complete it is for each channel the shop sells on, and what is missing
 * (listing-model/dynamic-form R4, ux "Channel strip"). Read from stored completeness, never computed here.
 */
export function ChannelCompletenessStrip({ states }: ChannelCompletenessStripProps) {
  if (states.length === 0) return null;
  const label = (c: string) => CHANNEL_LABELS[c as Channel] ?? c;
  const ready = states.filter((s) => s.missing === 0).map((s) => label(s.channel));
  const short = states.filter((s) => s.missing > 0);
  return (
    <div className="space-y-2 rounded-card border border-border bg-card p-3">
      <div className="flex flex-wrap gap-2">
        {states.map((s) => (
          <StatusBadge key={s.channel} tone={s.missing === 0 ? "success" : "warning"}>
            {COMPLETENESS_COPY.count(label(s.channel), s.required - s.missing, s.required)}
          </StatusBadge>
        ))}
      </div>
      {ready.length > 0 && <p className="text-small text-muted-foreground">{COMPLETENESS_COPY.ready(ready)}</p>}
      {short.map((s) => (
        <p key={s.channel} className="text-small text-muted-foreground">{COMPLETENESS_COPY.missing(label(s.channel), s.missingKeys)}</p>
      ))}
    </div>
  );
}
