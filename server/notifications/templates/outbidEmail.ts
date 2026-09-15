import { appUrl } from "@server/shared/app-url";
import { formatDate, formatPaise } from "../formatters";
import {
  button,
  closingNote,
  detailPanel,
  esc,
  greeting,
  paragraph,
  renderEmail,
  type DetailRow,
} from "./layout";

/** What this template renders — the caller maps its rows onto this. Money in paise. */
export interface OutbidEmailView {
  bidderName: string;
  productName: string;
  theirBidPaise: number;
  currentBidPaise: number;
  endAt: Date;
  slug: string;
}

/**
 * "Someone has bid more than you."
 *
 * This is the message that makes an auction an auction: without it a bidder bids once
 * and never learns they lost the lead (bidding spec R28). It leads with both numbers
 * and the deadline, because those are what decide whether the reader comes back.
 *
 * It names no other bidder — who is leading is never disclosed, only what they bid
 * (spec R16).
 */
export function getOutbidEmailTemplate(view: OutbidEmailView): string {
  const rows: DetailRow[] = [
    { label: "Your bid", value: formatPaise(view.theirBidPaise) },
    { label: "Bidding closes", value: formatDate(view.endAt) },
    { label: "Leading bid", value: formatPaise(view.currentBidPaise), final: true },
  ];

  return renderEmail({
    title: "You have been outbid",
    tagline: "Live Bidding",
    body: `
            ${greeting(`Hello ${view.bidderName}!`)}

            ${paragraph(
              `Someone has bid more than you on <strong>${esc(view.productName)}</strong>. You are no longer the highest bidder.`
            )}

            ${detailPanel(rows)}

            ${paragraph("There is still time to take the lead back.")}

            ${button(`${appUrl()}/bid/${esc(view.slug)}`, "Place a higher bid")}

            ${closingNote(
              "Bids are binding offers. Who is leading is never shown — only the amount.",
              "center"
            )}`,
    footer: {
      heading: "Questions about this auction?",
      note: "Contact our support team.",
    },
  });
}
