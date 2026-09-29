import { formatDeadline, formatPaise } from "../formatters";
import {
  alternateLink,
  buttonPair,
  closingNote,
  detailPanel,
  esc,
  greeting,
  noticeBox,
  paragraph,
  renderEmail,
  type DetailRow,
} from "./layout";

/** What this template renders — the caller maps its rows onto this. Money in paise. */
export interface BidOfferEmailView {
  bidderName: string;
  productName: string;
  /** "Size M · Red", or null where the product has no options. */
  option: string | null;
  amountPaise: number;
  expiresAt: Date;
  claimWindowHours: number;
  /** The offer page. Both buttons land on it; neither decides anything by being opened (winner-offer R7). */
  offerUrl: string;
}

/**
 * "The item is yours if you want it."
 *
 * Leads with the price and the deadline, because those decide whether the reader acts, and
 * says shipping is extra where the price is, so the bid is never read as the full cost
 * (winner-offer R4, R10a). Names no other bidder.
 */
export function getBidOfferEmailTemplate(view: BidOfferEmailView): string {
  const rows: DetailRow[] = [
    { label: "Item", value: esc(view.productName) },
    ...(view.option ? [{ label: "Option", value: esc(view.option) }] : []),
    { label: "Respond and pay by", value: formatDeadline(view.expiresAt) },
    { label: "Your price", value: `${formatPaise(view.amountPaise)} + shipping`, final: true },
  ];

  return renderEmail({
    title: "The item is yours to buy",
    tagline: "Live Bidding",
    body: `
            ${greeting(`Hello ${view.bidderName}!`)}

            ${paragraph(
              `Bidding has closed on <strong>${esc(view.productName)}</strong>, and it is being offered to you at your bid.`
            )}

            ${detailPanel(rows)}

            ${noticeBox(
              `You have ${esc(view.claimWindowHours)} hours to accept and pay. After that the item is offered to the next bidder.`
            )}

            ${buttonPair(
              { href: `${view.offerUrl}?choice=accept`, label: "Accept and pay" },
              { href: `${view.offerUrl}?choice=decline`, label: "Reject offer" }
            )}

            ${paragraph(
              "Not buying it after all? Rejecting passes it to the next bidder straight away, so they do not have to wait.",
              "text-align: center;"
            )}

            ${alternateLink(view.offerUrl)}

            ${closingNote(
              "Shipping is worked out for your address at checkout and added to your bid. This link is for you alone.",
              "center"
            )}`,
    footer: {
      heading: "Questions about this auction?",
      note: "Contact our support team.",
    },
  });
}
