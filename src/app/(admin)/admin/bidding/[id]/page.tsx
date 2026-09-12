/**
 * One event, with everyone who bid on it.
 *
 * The only page in the product that names a bidder (spec R37). The selling organisation
 * has its own view of the same event and never sees this one.
 */
import Image from "next/image";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/admin-auth";
import { adminBiddingService } from "@server/bidding/admin.bidding.service";
import { NotFoundError } from "@server/shared/domain-error";
import { PageHeader, PageShell } from "@/components/shared/page-shell";
import { Card } from "@/components/ui/card";
import { BiddingPhaseBadge } from "@/components/bidding/BiddingPhaseBadge";
import { BidLadder } from "@/components/bidding/BidLadder";
import { CopyLinkButton } from "@/components/bidding/CopyLinkButton";
import { formatCurrency } from "@/lib/format";

export const metadata = { robots: { index: false, follow: false } };

export default async function AdminBiddingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePlatformAdmin();
  const { id } = await params;

  const event = await adminBiddingService.detail(id).catch((error) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  const locations = await adminBiddingService.stockLocations(id);

  const variant = [event.product.size, event.product.color].filter(Boolean).join(" · ");

  return (
    <PageShell width="default">
      <PageHeader
        title={event.product.name}
        description={`${event.orgName}${variant ? ` · ${variant}` : ""}`}
        back={{ href: "/admin/bidding", label: "Back to bidding" }}
        actions={<CopyLinkButton path={`/bid/${event.slug}`} label="Copy public link" />}
      />

      <Card className="p-3 sm:p-4">
        <div className="flex items-start gap-4">
          <Image
            src={event.product.thumbnail}
            alt=""
            width={64}
            height={64}
            className="size-16 shrink-0 rounded-field object-cover"
          />
          <div className="min-w-0 flex-1 space-y-2">
            <BiddingPhaseBadge phase={event.phase} />
            <dl className="grid grid-cols-2 gap-3 text-2xs sm:grid-cols-4">
              <Fact label="Usually" value={formatCurrency(event.product.referencePricePaise)} />
              <Fact label="Opened at" value={formatCurrency(event.startingBidPaise)} />
              <Fact
                label={event.soldAmountPaise !== null ? "Sold for" : "Highest"}
                value={
                  event.soldAmountPaise !== null
                    ? formatCurrency(event.soldAmountPaise)
                    : event.highestBidPaise !== null
                      ? formatCurrency(event.highestBidPaise)
                      : "—"
                }
              />
              <Fact label="Bids" value={String(event.bidCount)} />
            </dl>
            {event.soldReason && (
              <p className="text-2xs text-muted-foreground">
                Note: {event.soldReason}
              </p>
            )}
          </div>
        </div>
      </Card>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">
          Bidders, highest first
        </h2>
        {event.phase === "LIVE" && (
          <p className="text-sm text-muted-foreground">
            Bidding is still running — an outcome can be recorded once it closes.
          </p>
        )}
        <BidLadder
          eventId={event.id}
          ladder={event.ladder}
          locations={locations}
          canRecordOutcome={event.phase === "ENDED"}
        />
      </section>
    </PageShell>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="uppercase tracking-label text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold">{value}</dd>
    </div>
  );
}
