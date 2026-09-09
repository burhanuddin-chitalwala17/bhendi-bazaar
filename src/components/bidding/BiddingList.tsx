import Image from "next/image";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { BiddingPhaseBadge } from "@/components/bidding/BiddingPhaseBadge";
import { CopyLinkButton } from "@/components/bidding/CopyLinkButton";
import { CancelBiddingButton } from "@/components/bidding/CancelBiddingButton";
import type { OrgBiddingSummary } from "@server/bidding/bidding.types";

/**
 * An organisation's events.
 *
 * It shows amounts and counts and never a bidder, at any phase — the org learns what
 * its item fetched, never who offered it (spec R16/R36). That is a property of the
 * type it receives, not a decision made here.
 */
export function BiddingList({
  events,
  apiPath,
}: {
  events: OrgBiddingSummary[];
  apiPath: string;
}) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing up for bidding yet. Create one to get a link you can share.
      </p>
    );
  }

  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {events.map((event) => (
        <li key={event.id}>
          <Card className="flex h-full flex-col gap-3 p-3 sm:p-4">
            <div className="flex items-start gap-3">
              <Image
                src={event.product.thumbnail}
                alt=""
                width={56}
                height={56}
                className="size-14 shrink-0 rounded-field object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-medium">
                    {event.product.name}
                  </p>
                  <BiddingPhaseBadge phase={event.phase} />
                </div>
                <p className="mt-0.5 text-2xs text-muted-foreground">
                  {variantLabel(event) ?? "No options"} · usually{" "}
                  {formatCurrency(event.product.referencePricePaise)}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-2 text-2xs">
              <div>
                <dt className="uppercase tracking-label text-muted-foreground">
                  {event.phase === "SOLD" ? "Sold for" : "Highest bid"}
                </dt>
                <dd className="mt-0.5 text-sm font-semibold">
                  {event.soldAmountPaise !== null
                    ? formatCurrency(event.soldAmountPaise)
                    : event.highestBidPaise !== null
                      ? formatCurrency(event.highestBidPaise)
                      : "—"}
                </dd>
              </div>
              <div>
                <dt className="uppercase tracking-label text-muted-foreground">Bids</dt>
                <dd className="mt-0.5 text-sm font-semibold">{event.bidCount}</dd>
              </div>
            </dl>

            <p className="text-2xs text-muted-foreground">
              {event.phase === "SCHEDULED"
                ? `Opens ${formatWhen(event.startAt)}`
                : `Closes ${formatWhen(event.endAt)}`}
            </p>

            <div className="mt-auto flex flex-wrap gap-2">
              <CopyLinkButton path={`/bid/${event.slug}`} />
              {event.status === "OPEN" && (
                <CancelBiddingButton
                  apiPath={`${apiPath}/${event.id}`}
                  hasBids={event.bidCount > 0}
                />
              )}
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function variantLabel(event: OrgBiddingSummary): string | null {
  const parts = [event.product.size, event.product.color].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function formatWhen(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
