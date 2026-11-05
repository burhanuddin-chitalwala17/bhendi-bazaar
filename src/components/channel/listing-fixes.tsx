import Link from "next/link";

import { Button } from "@/components/ui/button";
import { LISTING_FIX, type ListingFixDTO, type ListingScreenDTO } from "@server/channels/platform-listing.types";
import { SHOP_STATE, TICKET_KIND, type ShopTicketDTO } from "@server/requests/request.types";
import { StatusBadge } from "@/components/shared/badges/StatusBadge";
import { REQUESTS_COPY } from "@/components/requests/requests-copy";
import { ROUTES } from "@server/shared/routes";

import { AskAdminPicker } from "./ask-admin-picker";
import { FIX } from "./platform-listing-copy";

/** "How to fix it" (marketplace-publish Q24): each complaint at the place it is fixed, one button each. */
export function ListingFixes({ orgId, screen, tickets = [] }: { orgId: string; screen: ListingScreenDTO; tickets?: ShopTicketDTO[] }) {
  if (screen.fixes.length === 0) return null;
  const editProduct = ROUTES.org.editProduct(orgId, screen.productId);
  const line = (fix: ListingFixDTO) => {
    const names = FIX.list(fix.names);
    switch (fix.kind) {
      case LISTING_FIX.BRAND:
        return screen.locked.brand
          ? { text: FIX.brand(screen.label, screen.locked.brand, names), action: FIX.brandAction, href: ROUTES.org.listing(orgId) }
          : { text: FIX.brandMissing(screen.label, names), action: FIX.brandMissingAction, href: editProduct };
      case LISTING_FIX.MRP:
        return { text: FIX.mrp(screen.label), action: FIX.mrpAction, href: editProduct };
      case LISTING_FIX.FACTS:
        return { text: FIX.facts(names), action: FIX.factsAction, href: editProduct };
      case LISTING_FIX.ADMIN:
        return { text: REQUESTS_COPY.needsDetails(screen.label, fix.names.length, names), action: null, href: null };
    }
  };
  const type = screen.draft?.marketplaceType ?? screen.productName;
  // The fields ticket this listing waits on, raised by itself (setup-requests Q5); "Ask the admin" only before it exists.
  const ticket = tickets.find((t) => t.kind === TICKET_KIND.AMAZON_FIELDS) ?? null;
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
                <TicketLine ticket={ticket} label={screen.label} editHref={editProduct} />
              ) : (
                <AskAdminPicker message={FIX.adminMessage(screen.label, type, screen.productName, FIX.list(fix.names))} />
              )}
            </li>
          );
        })}
      </ol>
      <p className="text-muted-foreground">{FIX.after(screen.label)}</p>
    </div>
  );
}

/** Where our side of a fix stands, in one word (setup-requests Q31), and the shop's next step when ready. */
function TicketLine({ ticket, label, editHref }: { ticket: ShopTicketDTO; label: string; editHref: string }) {
  const names = ticket.names.join(", ");
  return (
    <div className="flex flex-col items-start gap-1">
      <StatusBadge tone={ticket.state === SHOP_STATE.READY ? "success" : ticket.state === SHOP_STATE.WITH_US ? "info" : "neutral"}>{REQUESTS_COPY.shopState[ticket.state]}</StatusBadge>
      {ticket.state === SHOP_STATE.READY && names && (
        <>
          <p>{REQUESTS_COPY.fillThese(names)}</p>
          <Button asChild size="sm" className="min-h-10"><Link href={editHref}>{FIX.factsAction}</Link></Button>
        </>
      )}
      {ticket.state === SHOP_STATE.NOT_SUPPORTED && <p>{REQUESTS_COPY.notSupported(label, names)}</p>}
    </div>
  );
}
