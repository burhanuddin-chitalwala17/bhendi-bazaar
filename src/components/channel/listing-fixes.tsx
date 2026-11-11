import Link from "next/link";

import { Button } from "@/components/ui/button";
import { LISTING_FIX, type ListingFixDTO, type ListingScreenDTO } from "@server/channels/platform-listing.types";
import { SHOP_STATE, type ShopTicketDTO } from "@server/requests/request.types";
import { MARKETPLACE_KIND } from "@server/requests/marketplace/marketplace.types";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { REQUESTS_COPY } from "@/components/requests/requests-copy";
import { RaiseRequestButton, RequestsLink } from "@/components/requests/raise-request-button";
import { formatDate } from "@/lib/format";
import { ROUTES } from "@server/shared/routes";
import { withFrom } from "@/lib/safe-callback-url";
import { BRAND_FIELD_ID } from "@/components/shared/forms/product/ProductBrandField";

import { FIX } from "./platform-listing-copy";

/** "How to fix it" (marketplace-publish Q24): each complaint at the place it is fixed, one button each. */
/** `from` is this listing screen, so Edit product comes back here on Save and Back (navigation-flows R4). */
export function ListingFixes({ orgId, screen, tickets = [], from }: { orgId: string; screen: ListingScreenDTO; tickets?: ShopTicketDTO[]; from?: string }) {
  if (screen.fixes.length === 0) return null;
  const back = (href: string) => (from ? withFrom(href, from) : href);
  const editProduct = back(ROUTES.org.editProduct(orgId, screen.productId));
  const line = (fix: ListingFixDTO) => {
    const names = FIX.list(fix.names);
    switch (fix.kind) {
      case LISTING_FIX.BRAND:
        return screen.locked.brand
          ? { text: FIX.brand(screen.label, screen.locked.brand, names), action: FIX.brandAction, href: ROUTES.org.listing(orgId) }
          : { text: FIX.brandMissing(screen.label, names), action: FIX.brandMissingAction, href: back(ROUTES.org.editProductField(orgId, screen.productId, "details", BRAND_FIELD_ID)) };
      case LISTING_FIX.MRP:
        return { text: FIX.mrp(screen.label), action: FIX.mrpAction, href: editProduct };
      case LISTING_FIX.FACTS:
        return { text: FIX.facts(names), action: FIX.factsAction, href: editProduct };
      case LISTING_FIX.ADMIN:
        return { text: REQUESTS_COPY.needsDetails(screen.label, fix.names.length, names), action: null, href: null };
    }
  };
  // The fields ticket this listing waits on, raised by itself (setup-requests Q5); one tap raises it before it exists (Q36).
  const ticket = fieldsTicket(tickets);
  return (
    <div className="flex flex-col gap-3">
      <p className="font-semibold">{FIX.title}</p>
      <ol className="flex flex-col gap-3">
        {screen.fixes.map((fix) => {
          const { text, action, href } = line(fix);
          return (
            <li key={fix.kind} className="flex flex-col items-start gap-1">
              <p>{text}</p>
              {href && action ? (
                <Button asChild variant="outline" size="sm" className="min-h-10">
                  <Link href={href}>{action}</Link>
                </Button>
              ) : ticket ? (
                <TicketLine orgId={orgId} ticket={ticket} label={screen.label} editHref={editProduct} />
              ) : (
                <RaiseRequestButton orgId={orgId} channel={screen.channel} productId={screen.productId} />
              )}
            </li>
          );
        })}
      </ol>
      <p className="text-muted-foreground">{FIX.after(screen.label)}</p>
    </div>
  );
}

export const fieldsTicket = (tickets: readonly ShopTicketDTO[]) => tickets.find((t) => t.kind === MARKETPLACE_KIND.FIELDS) ?? null;

/** Where our side of a fix stands (setup-requests Q31), when it was raised, what it covers, and where to follow it (Q36). */
function TicketLine({ orgId, ticket, label, editHref }: { orgId: string; ticket: ShopTicketDTO; label: string; editHref: string }) {
  const names = ticket.names.join(", ");
  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={ticket.state === SHOP_STATE.READY ? "success" : ticket.state === SHOP_STATE.WITH_US ? "info" : "neutral"}>{REQUESTS_COPY.shopState[ticket.state]}</StatusBadge>
        <span className="text-small text-muted-foreground">{REQUESTS_COPY.raisedOn(formatDate(ticket.raisedAt, { day: "numeric", month: "short" }))}</span>
      </div>
      {ticket.state === SHOP_STATE.WITH_US && <p className="text-small text-muted-foreground">{names && <>{REQUESTS_COPY.covers(names)} </>}{REQUESTS_COPY.withUsHint}</p>}
      {ticket.state === SHOP_STATE.READY && (
        <>
          <p>{REQUESTS_COPY.readyFill}</p>
          <Button asChild size="sm" className="min-h-10"><Link href={editHref}>{FIX.factsAction}</Link></Button>
        </>
      )}
      {ticket.state === SHOP_STATE.NOT_SUPPORTED && <p>{REQUESTS_COPY.notSupported(label, names)}</p>}
      <RequestsLink orgId={orgId} />
    </div>
  );
}
