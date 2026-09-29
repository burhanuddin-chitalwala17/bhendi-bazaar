/**
 * An auction offer, as the one person it was made to sees it (winner-offer R4, R7, R11).
 *
 * Reached from the offer email. Rendering it changes nothing: the email's accept and decline
 * links both land here, and only a tap posts, so a mail scanner that opens links in advance
 * cannot answer for the bidder. A closed offer shows why it closed, never a 404, because the
 * email stays in an inbox long after.
 */
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { offerService } from "@server/bidding/offer.service";
import { NotFoundError } from "@server/shared/domain-error";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/shared/page-shell";
import { BidCountdown } from "@/components/bidding/BidCountdown";
import { OfferActions } from "@/components/bidding/OfferActions";

// A link carrying a credential: never indexed, never cached by a crawler.
export const metadata: Metadata = {
  title: "Your auction offer",
  robots: { index: false, follow: false },
};

const CLOSED_COPY: Record<string, string> = {
  declined: "You declined this offer, and the item has passed to the next bidder.",
  expired: "The time to accept and pay has passed, and the item has passed to the next bidder.",
  withdrawn: "This offer was withdrawn by the store.",
  skipped: "This offer was not made.",
};

export default async function BidOfferPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ choice?: string }>;
}) {
  const [{ token }, { choice }] = await Promise.all([params, searchParams]);
  const offer = await offerService.view(token).catch((error: unknown) => {
    if (error instanceof NotFoundError) return null;
    throw error;
  });
  if (!offer) notFound();

  const option = [offer.size ? `Size ${offer.size}` : null, offer.color].filter(Boolean).join(" · ");
  const initialChoice = choice === "accept" || choice === "decline" ? choice : null;

  return (
    <PageShell width="narrow" className="px-3 pb-40 pt-4 sm:px-4 md:pb-8">
      <div className="space-y-5">
        <div className="flex gap-3">
          <div className="relative size-24 shrink-0 overflow-hidden rounded-card border border-border bg-muted">
            <Image
              src={offer.product.thumbnail}
              alt={offer.product.name}
              fill
              sizes="96px"
              className="object-cover"
            />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-2xs uppercase tracking-label text-muted-foreground">
              {offer.state === "paid" ? "Bought at auction" : "Your auction offer"}
            </p>
            <h1 className="font-heading text-lg font-semibold leading-tight">
              {offer.product.name}
            </h1>
            {option && (
              <p className="text-2xs uppercase tracking-label text-muted-foreground">{option}</p>
            )}
          </div>
        </div>

        <div className="space-y-1 rounded-card border border-border bg-card p-4">
          <p className="text-2xs uppercase tracking-label text-muted-foreground">Your price</p>
          <p className="font-heading text-3xl font-bold">{formatCurrency(offer.amountPaise)}</p>
          <p className="text-sm text-muted-foreground">
            + shipping, worked out for your address at checkout
          </p>
        </div>

        {(offer.state === "open" || offer.state === "accepted") && offer.expiresAt && (
          <>
            <div className="rounded-card border border-warning/40 bg-warning/10 p-3">
              <p className="text-2xs uppercase tracking-label text-muted-foreground">
                Time left to accept and pay
              </p>
              <p className="font-heading text-2xl font-semibold tabular-nums">
                <BidCountdown
                  endAt={offer.expiresAt.toISOString()}
                  serverNow={offer.serverNow.toISOString()}
                  endedLabel="Time is up"
                />
              </p>
              <p className="mt-1 text-2xs text-muted-foreground">
                After that the item is offered to the next highest bidder.
              </p>
            </div>
            <p className="text-sm">
              Hello {offer.bidderName}, bidding has closed and this item is yours to buy at
              your bid.
            </p>
            <OfferActions token={token} state={offer.state} initialChoice={initialChoice} />
          </>
        )}

        {offer.state === "paid" && (
          <p className="rounded-card border border-success/40 bg-success/10 p-3 text-sm">
            Paid — thank you. Your order confirmation is in your email.
          </p>
        )}

        {offer.state === "closed" && (
          <div className="space-y-3 rounded-card border border-border bg-card p-4">
            <p className="text-sm">{CLOSED_COPY[offer.closedReason ?? "expired"]}</p>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/product/${offer.product.slug}`}>See this item in the shop</Link>
            </Button>
          </div>
        )}
      </div>
    </PageShell>
  );
}
