/**
 * The public bidding page.
 *
 * A shared link, so it renders for someone who has never signed in and reads correctly
 * in every phase — before it opens, while it runs, and long after it closed (spec R18).
 * A finished event shows a closed page rather than a missing one, because the link keeps
 * circulating for weeks afterwards.
 *
 * Rendered on the server, which is what lets the countdown be honest: the platform's
 * clock travels with the page, and the client counts down against the difference rather
 * than trusting the device (spec R17).
 */
import { optionalActiveSession } from "@/lib/admin-auth";
import { cache } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { biddingService } from "@server/bidding/bidding.service";
import { NotFoundError } from "@server/shared/domain-error";
import { appUrl } from "@server/shared/app-url";
import { APP_NAME } from "@/lib/config";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/shared/page-shell";
import { BidPanel } from "@/components/bidding/BidPanel";
import { BidCountdown } from "@/components/bidding/BidCountdown";
import { ShareButton } from "@/components/shared/ShareButton";

/** Metadata and the page share one read (the product page's convention). */
const loadEvent = cache(async (slug: string) => {
  try {
    return await biddingService.publicView(slug);
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await loadEvent(slug);
  if (!event) return {};

  const url = `${appUrl()}/bid/${slug}`;
  const price =
    event.highestBidPaise !== null
      ? `Currently at ${formatCurrency(event.highestBidPaise)}`
      : `Opening at ${formatCurrency(event.startingBidPaise)}`;
  const description =
    event.phase === "LIVE"
      ? `${price} · bidding closes ${absoluteWhen(event.endAt)}`
      : event.phase === "SCHEDULED"
        ? `Bidding opens ${absoluteWhen(event.startAt)}`
        : "Bidding has closed on this item.";

  return {
    title: `${event.product.name} — live bidding`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: APP_NAME,
      title: `${event.product.name} — live bidding`,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: event.product.name,
      description,
    },
  };
}

export default async function BiddingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [event, session] = await Promise.all([
    loadEvent(slug),
    optionalActiveSession({ onBlocked: "allow" }),
  ]);
  // A slug that never existed is genuinely missing. A finished event is not.
  if (!event) notFound();
  const isOver = event.phase !== "LIVE" && event.phase !== "SCHEDULED";

  return (
    <PageShell width="default" className="pb-24 md:pb-8">
      <div className="grid gap-5 md:grid-cols-2 md:gap-8">
        {/* DOM order is the mobile reading order: picture, then what it is, then the
            bidding itself. On a wider screen the picture moves alongside. */}
        <div className="space-y-3">
          <div className="relative aspect-square overflow-hidden rounded-card border border-border bg-muted">
            <Image
              src={event.product.thumbnail}
              alt={event.product.name}
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
              preload
            />
            <StatusBadge tone={event.phase === "LIVE" ? "success" : event.phase === "SCHEDULED" ? "info" : "neutral"} dot className="absolute left-3 top-3">
              {event.phase === "LIVE" ? "Live bidding" : event.phase === "SCHEDULED" ? "Bidding soon" : "Bidding closed"}
            </StatusBadge>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-start gap-2">
              <h1 className="min-w-0 flex-1 font-heading text-headline font-semibold">
                {event.product.name}
              </h1>
              <ShareButton
                url={`/bid/${slug}`}
                title={`${event.product.name} — bidding on ${APP_NAME}`}
                text={`Bidding is open on ${event.product.name}`}
                variant="ghost"
                size="lg"
                shape="icon"
              />
            </div>
            {/* R20: what the contest is against. */}
            <p className="text-small text-muted-foreground">
              Usually {formatCurrency(event.product.referencePricePaise)}
            </p>
          </div>

          {event.phase === "LIVE" && (
            <BidPanel
              slug={slug}
              endAt={event.endAt.toISOString()}
              serverNow={event.serverNow.toISOString()}
              isSignedIn={Boolean(session?.user?.id)}
              quickBidsPaise={event.quickBidsPaise}
              initial={{
                highestBidPaise: event.highestBidPaise,
                bidCount: event.bidCount,
                minBidPaise: event.minBidPaise,
                maxBidPaise: event.maxBidPaise,
              }}
            />
          )}

          {event.phase === "SCHEDULED" && (
            <div className="space-y-3 rounded-card border border-border bg-card p-4">
              <p className="text-label uppercase text-muted-foreground">
                Bidding opens
              </p>
              <p className="font-heading text-headline font-semibold">
                {absoluteWhen(event.startAt)}
              </p>
              <p className="text-small text-muted-foreground">
                Opening bid {formatCurrency(event.startingBidPaise)}. Come back
                then — or share this link with someone who will want it.
              </p>
              <p className="text-small font-medium tabular-nums">
                <span className="text-label uppercase text-muted-foreground">
                  Opens in{" "}
                </span>
                <BidCountdown
                  endAt={event.startAt.toISOString()}
                  serverNow={event.serverNow.toISOString()}
                />
              </p>
            </div>
          )}

          {isOver && (
            <div className="space-y-3 rounded-card border border-border bg-card p-4">
              <p className="text-label uppercase text-muted-foreground">
                Bidding has closed
              </p>
              {event.soldAmountPaise !== null ? (
                <p className="font-heading text-3xl font-bold">
                  Sold for {formatCurrency(event.soldAmountPaise)}
                </p>
              ) : event.highestBidPaise !== null ? (
                <p className="font-heading text-3xl font-bold">
                  Finished at {formatCurrency(event.highestBidPaise)}
                </p>
              ) : (
                <p className="text-small text-muted-foreground">
                  This one closed without any bids.
                </p>
              )}
              <p className="text-small text-muted-foreground">
                {event.phase === "CANCELLED"
                  ? "This event was called off."
                  : `${event.bidCount} bid${event.bidCount === 1 ? "" : "s"} were placed.`}
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href={`/product/${event.product.slug}`}>
                  See this item in the shop
                </Link>
              </Button>
            </div>
          )}

          <p className="text-2xs leading-relaxed text-muted-foreground">
            The highest bidder is contacted directly once bidding closes. Bids
            are binding offers; who is leading is never shown, only the amount.
          </p>
        </div>
      </div>
    </PageShell>
  );
}

/**
 * Always an absolute date and time, never "in 2 hours". Shares and previews are cached
 * by the apps they land in, and a frozen relative time keeps being wrong (spec R19).
 */
function absoluteWhen(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}
