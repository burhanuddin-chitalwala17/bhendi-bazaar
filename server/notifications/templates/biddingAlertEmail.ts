import { closingNote, esc, paragraph, renderEmail } from "./layout";

/** What this template renders. Plain lines; each is escaped here. */
export interface BiddingAlertEmailView {
  headline: string;
  lines: string[];
}

/**
 * To the store, not a buyer: an auction needs a person — its offers ran out, or a paid order
 * arrived on an offer that had already closed (winner-offer R20, D8).
 */
export function getBiddingAlertEmailTemplate(view: BiddingAlertEmailView): string {
  return renderEmail({
    title: view.headline,
    tagline: "Bidding",
    body: `
            ${view.lines.map((line) => paragraph(esc(line))).join("\n")}

            ${closingNote("Sent automatically by the auction offer chain.")}`,
    footer: {
      heading: "Store alert",
      note: "This message went to the store inbox only.",
    },
  });
}
