import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PlatformMark } from "@/components/ui/icons/platform-marks";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { AskAdminPicker } from "@/components/channel/ask-admin-picker";
import { FIX } from "@/components/channel/readiness-fix-copy";
import { CHANNEL, CHANNEL_LABELS, type Channel } from "@server/shared/channels";
import type { ChannelSummaryRow } from "@server/listing/channel-readiness.service";
import { cn } from "@/lib/utils";

import { CHANNEL_FILTER } from "../channel-filter-copy";

/**
 * One pill per channel the shop sells on, each saying whether its products would all go
 * (design-system Q35). A pill with products to fix filters the list to them; the URL holds it,
 * so the server reads it. Replaces the "Ready to list elsewhere" card.
 */
export function ChannelPills({
  rows,
  current,
  hrefFor,
}: {
  rows: readonly ChannelSummaryRow[];
  current?: Channel;
  hrefFor: (channel: Channel | undefined) => string;
}) {
  if (rows.length === 0) return null;
  return (
    <nav aria-label={CHANNEL_FILTER.label} className="-mx-4 md:mx-0">
      <ul className="no-scrollbar flex gap-2 overflow-x-auto px-4 md:flex-wrap md:px-0">
        {rows.map((row) => {
          const label = CHANNEL_LABELS[row.channel];
          const active = row.channel === current;
          const toFix = row.incomplete;
          return (
            <li key={row.channel} className="shrink-0">
              <Button
                asChild
                variant="outline"
                size="sm"
                className={cn("h-auto min-h-10 gap-2 rounded-full py-1 pl-1.5 pr-3", active && "border-foreground bg-foreground/5")}
              >
                <Link
                  href={hrefFor(active || toFix === 0 ? undefined : row.channel)}
                  prefetch={false}
                  scroll={false}
                  aria-current={active ? "true" : undefined}
                  aria-label={active ? CHANNEL_FILTER.clear(label) : undefined}
                >
                  {row.channel !== CHANNEL.STORE && <PlatformMark name={row.channel} size="sm" />}
                  <span className="text-small font-medium">{label}</span>
                  <StatusBadge tone={toFix === 0 ? "success" : "warning"}>
                    {toFix === 0 ? CHANNEL_FILTER.allReady : CHANNEL_FILTER.toFix(toFix)}
                  </StatusBadge>
                  {active && <Icon name="close" size="xs" />}
                </Link>
              </Button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Above the filtered list: what keeps these products off, grouped, each with its one action. */
export function ChannelFilterNote({
  row,
  fixHref,
  channelsHref,
}: {
  row: ChannelSummaryRow;
  fixHref: (fact: string) => string;
  channelsHref: string;
}) {
  const label = CHANNEL_LABELS[row.channel];
  return (
    <div className="space-y-2 rounded-card border border-border bg-card p-3 text-small md:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-medium text-foreground">{CHANNEL_FILTER.showing(row.incomplete, label)}</p>
        <Link href={channelsHref} prefetch={false} className="text-primary underline-offset-4 hover:underline">
          {CHANNEL_FILTER.whereYouSell}
        </Link>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
        {row.gaps.map((gap) => (
          <li key={gap.fact} className="flex min-h-10 items-center gap-2 md:min-h-0">
            <span>{FIX.need(gap.count, gap.label)}</span>
            {gap.fixable && (
              <Link href={fixHref(gap.fact)} prefetch={false} className="font-medium text-primary underline-offset-4 hover:underline">
                {FIX.fixThem}
              </Link>
            )}
          </li>
        ))}
        {row.noCategory > 0 && (
          <li className="flex items-center gap-2">
            <span>{FIX.noCategory(row.noCategory, label)}</span>
            <AskAdminPicker message={`${row.noCategory} of my products have no ${label} category. Please map their product type for ${label}.`} />
          </li>
        )}
      </ul>
    </div>
  );
}
