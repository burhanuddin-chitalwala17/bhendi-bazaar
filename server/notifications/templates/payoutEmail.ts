import { appUrl } from "@server/shared/app-url";
import { formatPaise, formatShortDate } from "../formatters";
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

/** What this template renders — the caller maps its settlement onto this. */
export interface PayoutEmailView {
  orgId: string;
  orgName: string;
  code: string;
  amountPaise: number;
  reference: string | null;
  paidAt: Date;
}

export function getPayoutEmailTemplate(settlement: PayoutEmailView): string {
  const rows: DetailRow[] = [
    { label: "Settlement", value: `#${esc(settlement.code)}` },
    { label: "Paid On", value: formatShortDate(settlement.paidAt) },
    ...(settlement.reference
      ? [{ label: "Reference", value: esc(settlement.reference) }]
      : []),
    { label: "Amount", value: formatPaise(settlement.amountPaise), final: true },
  ];

  return renderEmail({
    title: "Payout Sent",
    tagline: "Org Payout",
    banner: "✓ Payout Sent",
    body: `
            ${greeting(`Hello ${settlement.orgName}!`)}

            ${paragraph(
              `We've sent your payout for settlement #${esc(settlement.code)}. It should reflect in your account shortly.`
            )}

            ${detailPanel(rows)}

            ${button(`${appUrl()}/org/${settlement.orgId}/earnings`, "View Earnings")}

            ${closingNote("Thank you for selling with Bhendi Bazaar.", "center")}`,
    footer: {
      heading: "Questions about this payout?",
      note: "Contact our org support team.",
    },
  });
}
