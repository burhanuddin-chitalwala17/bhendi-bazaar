import Link from "next/link";

import { Icon, type IconName } from "@/components/ui/icon";
import { RefreshButton } from "@/components/channel/refresh-button";
import type { AttentionLine } from "./attention-lines";
import { HOME_COPY } from "./home-copy";

/** What each line is about, at a glance. A key with no entry gets the plain warning mark. */
const LINE_ICON: Record<string, IconName> = {
  toPack: "parcel",
  channel: "connect",
  stock: "location",
  lowStock: "warning",
  photos: "photo",
  teamEdits: "team",
};

/**
 * "Needs you now" (design-system Q31): every line says what waits and opens the fix; the list is
 * already capped and ordered money and buyers first by `attentionLines`. Hidden when nothing does:
 * the page says all clear instead.
 */
export function NeedsYouNow({ lines }: { lines: AttentionLine[] }) {
  if (lines.length === 0) return null;
  return (
    <section className="space-y-2" aria-labelledby="needs-you-now">
      <h2 id="needs-you-now" className="font-heading text-title font-semibold">{HOME_COPY.needsYou}</h2>
      <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-card">
        {lines.map((line) => <LineView key={line.key} line={line} />)}
      </ul>
    </section>
  );
}

function LineView({ line }: { line: AttentionLine }) {
  const icon = LINE_ICON[line.key] ?? "warning";
  if (!line.ok) {
    return (
      <li className="flex min-h-14 flex-wrap items-center gap-3 p-3">
        <Icon name={icon} size="md" tone="muted" />
        <span className="min-w-0 flex-1 text-small text-muted-foreground">{line.text}</span>
        <RefreshButton label={line.action} />
      </li>
    );
  }
  return (
    <li>
      <Link
        prefetch={false}
        href={line.href}
        className="flex min-h-14 items-center gap-3 p-3 transition-colors duration-fast ease-standard hover:bg-muted/60"
      >
        <Icon name={icon} size="md" tone="primary" />
        <span className="min-w-0 flex-1 text-small font-medium text-foreground">{line.text}</span>
        <Icon name="next" size="sm" tone="muted" />
      </Link>
    </li>
  );
}
