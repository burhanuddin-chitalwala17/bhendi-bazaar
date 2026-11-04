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
import { ADMIN_BIDDING_COPY } from "../bidding-copy";
import { ROUTES } from "@server/shared/routes";

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

  return (
    <PageShell width="default">
      <PageHeader
        title={event.product.name}
        description={event.orgName}
        back={{ href: ROUTES.admin.bidding, label: ADMIN_BIDDING_COPY.back }}
        actions={
          <CopyLinkButton
            path={ROUTES.bid(event.slug)}
            label={ADMIN_BIDDING_COPY.copyLink}
          />
        }
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
              <Fact
                label={ADMIN_BIDDING_COPY.usually}
                value={formatCurrency(event.product.referencePricePaise)}
              />
              <Fact
                label={ADMIN_BIDDING_COPY.openedAt}
                value={formatCurrency(event.startingBidPaise)}
              />
              <Fact
                label={event.soldAmountPaise !== null ? ADMIN_BIDDING_COPY.soldFor : ADMIN_BIDDING_COPY.highest}
                value={
                  event.soldAmountPaise !== null
                    ? formatCurrency(event.soldAmountPaise)
                    : event.highestBidPaise !== null
                      ? formatCurrency(event.highestBidPaise)
                      : ADMIN_BIDDING_COPY.none
                }
              />
              <Fact label={ADMIN_BIDDING_COPY.bids} value={String(event.bidCount)} />
            </dl>
            {event.soldReason && (
              <p className="text-2xs text-muted-foreground">
                {ADMIN_BIDDING_COPY.note(event.soldReason)}
              </p>
            )}
          </div>
        </div>
      </Card>

      <section className="space-y-3">
        <h2 className="font-heading text-title font-semibold">
          {ADMIN_BIDDING_COPY.bidders}
        </h2>
        {event.phase === "LIVE" && (
          <p className="text-small text-muted-foreground">
            {ADMIN_BIDDING_COPY.stillRunning}
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
      <dt className="uppercase tracking-label text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-small font-semibold">{value}</dd>
    </div>
  );
}
