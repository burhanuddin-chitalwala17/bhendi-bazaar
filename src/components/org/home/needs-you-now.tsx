import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { RefreshButton } from "@/components/channel/refresh-button";
import type { AttentionLine } from "./attention-lines";
import { HOME_COPY } from "./home-copy";

const SHOWN = 3;

/** "Needs you now" (R2): hidden when nothing does; three lines, the rest behind "See all". */
export function NeedsYouNow({ lines }: { lines: AttentionLine[] }) {
  if (lines.length === 0) return null;
  const first = lines.slice(0, SHOWN);
  const rest = lines.slice(SHOWN);
  return (
    <section className="space-y-2" aria-labelledby="needs-you-now">
      <h2 id="needs-you-now" className="font-heading text-base font-semibold">{HOME_COPY.needsYou}</h2>
      <ul className="space-y-2">{first.map((line) => <LineView key={line.key} line={line} />)}</ul>
      {rest.length > 0 && (
        <details>
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-primary">
            {HOME_COPY.seeAll(lines.length)}
          </summary>
          <ul className="space-y-2">{rest.map((line) => <LineView key={line.key} line={line} />)}</ul>
        </details>
      )}
    </section>
  );
}

function LineView({ line }: { line: AttentionLine }) {
  if (!line.ok) {
    return (
      <li className="flex min-h-14 flex-wrap items-center gap-3 rounded-card border border-border bg-card p-3">
        <span className="min-w-0 flex-1 text-sm text-muted-foreground">{line.text}</span>
        <RefreshButton label={line.action} />
      </li>
    );
  }
  return (
    <li>
      <Link
        prefetch={false}
        href={line.href}
        className="flex min-h-14 items-center gap-3 rounded-card border border-border bg-card p-3 transition-colors hover:bg-muted/60"
      >
        <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{line.text}</span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}
