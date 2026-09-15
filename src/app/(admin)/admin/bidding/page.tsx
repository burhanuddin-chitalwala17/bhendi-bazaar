/**
 * Every bidding event on the platform, newest first.
 *
 * The platform's queue: what has closed and still needs an outcome, and what is
 * running. Only this side ever sees a bidder, so it sits behind the platform-admin
 * guard rather than merely being unlinked from the org console.
 */
import Link from "next/link";
import Image from "next/image";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { adminBiddingService } from "@server/bidding/admin.bidding.service";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BiddingPhaseBadge } from "@/components/bidding/BiddingPhaseBadge";
import { formatCurrency } from "@/lib/format";

export const metadata = { robots: { index: false, follow: false } };

export default async function AdminBiddingPage() {
  await requirePlatformAdmin();
  const events = await adminBiddingService.list();
  const awaiting = events.filter((event) => event.phase === "ENDED");

  return (
    <PageShell width="wide">
      <PageHeader
        title="Bidding"
        description={
          awaiting.length > 0
            ? `${awaiting.length} closed ${awaiting.length === 1 ? "event needs" : "events need"} an outcome. Until one is recorded, the item stays off sale.`
            : "Every bidding event across the platform."
        }
      />

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No organisation has put anything up for bidding yet.
        </p>
      ) : (
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
                      {event.orgName} · {event.bidCount} bid
                      {event.bidCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>

                <p className="text-sm font-semibold">
                  {event.soldAmountPaise !== null
                    ? `Sold for ${formatCurrency(event.soldAmountPaise)}`
                    : event.highestBidPaise !== null
                      ? `Highest ${formatCurrency(event.highestBidPaise)}`
                      : "No bids"}
                </p>

                <Button asChild variant="outline" size="sm" className="mt-auto w-fit">
                  <Link href={`/admin/bidding/${event.id}`}>
                    {event.phase === "ENDED" ? "Record the outcome" : "View bidders"}
                  </Link>
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
