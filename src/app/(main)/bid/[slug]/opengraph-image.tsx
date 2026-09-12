/**
 * The social preview for a bidding link (spec R19, bidding D18).
 *
 * This is the first dynamic OG image in the repo, and the rules it follows are worth
 * stating. It shows an **absolute** closing time and the price as at generation — never
 * a relative countdown. Scrapers cache aggressively and re-serve the same picture for
 * days, so "2 hours left" would keep being wrong long after it stopped being true,
 * whereas a date is merely older.
 *
 * Regenerated at most once a minute, so a link shared repeatedly during a busy auction
 * carries a roughly current price without a render per scrape.
 */
import { ImageResponse } from "next/og";
import { biddingService } from "@server/bidding/bidding.service";
import { NotFoundError } from "@server/shared/domain-error";
import { APP_NAME } from "@/lib/config";
import { formatCurrency } from "@/lib/format";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 60;
export const alt = "Live bidding";

export default async function Image({ params }: { params: { slug: string } }) {
  const event = await biddingService.publicView(params.slug).catch((error) => {
    if (error instanceof NotFoundError) return null;
    throw error;
  });

  if (!event) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
            background: "#18181b",
            color: "#fafafa",
            fontSize: 56,
          }}
        >
          {APP_NAME}
        </div>
      ),
      size
    );
  }

  const isLive = event.phase === "LIVE";
  const headline = isLive
    ? "LIVE BIDDING"
    : event.phase === "SCHEDULED"
      ? "BIDDING OPENS SOON"
      : "BIDDING CLOSED";

  const amount =
    event.soldAmountPaise ?? event.highestBidPaise ?? event.startingBidPaise;
  const amountLabel =
    event.soldAmountPaise !== null
      ? "Sold for"
      : event.highestBidPaise !== null
        ? "Current bid"
        : "Opening bid";

  const when = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(event.phase === "SCHEDULED" ? event.startAt : event.endAt);

  const variant = [event.product.size, event.product.color]
    .filter(Boolean)
    .join(" · ");

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "#0f0f11",
          color: "#fafafa",
        }}
      >
        <img
          src={event.product.thumbnail}
          alt=""
          width={630}
          height={630}
          style={{ width: 630, height: 630, objectFit: "cover" }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "56px 48px",
            flex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              background: isLive ? "#e11d48" : "#3f3f46",
              borderRadius: 999,
              padding: "10px 22px",
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: 2,
            }}
          >
            {headline}
          </div>

          <div
            style={{
              display: "flex",
              fontSize: 52,
              fontWeight: 700,
              lineHeight: 1.15,
              marginTop: 28,
            }}
          >
            {event.product.name.length > 46
              ? `${event.product.name.slice(0, 46)}…`
              : event.product.name}
          </div>

          {variant && (
            <div style={{ display: "flex", fontSize: 26, color: "#a1a1aa", marginTop: 10 }}>
              {variant}
            </div>
          )}

          <div style={{ display: "flex", fontSize: 24, color: "#a1a1aa", marginTop: 36 }}>
            {amountLabel}
          </div>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 800, lineHeight: 1.1 }}>
            {formatCurrency(amount)}
          </div>

          <div style={{ display: "flex", fontSize: 26, color: "#d4d4d8", marginTop: 24 }}>
            {event.phase === "SCHEDULED" ? "Opens" : "Closes"} {when}
          </div>

          <div style={{ display: "flex", fontSize: 24, color: "#71717a", marginTop: 32 }}>
            {APP_NAME}
          </div>
        </div>
      </div>
    ),
    size
  );
}
