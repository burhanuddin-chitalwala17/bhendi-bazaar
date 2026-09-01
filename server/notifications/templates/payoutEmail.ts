import { baseEmailStyles } from "./styles/baseEmailStyles";
import { formatCurrency, formatShortDate } from "../formatters";
import { appUrl } from "@server/shared/app-url";
import { paiseToRupees } from "@server/shared/money";

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
  const earningsUrl = `${appUrl()}/org/${settlement.orgId}/earnings`;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payout Sent - Bhendi Bazaar</title>
        <style>
          ${baseEmailStyles}

          .success-banner {
            background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
            color: white;
            padding: 20px 30px;
            text-align: center;
            font-size: 18px;
            font-weight: 600;
          }
          .payout-details {
            background: #f8f8f8;
            border: 2px solid #d4af37;
            border-radius: 8px;
            padding: 20px;
            margin: 25px 0;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            font-size: 15px;
          }
          .detail-row.final {
            border-top: 2px solid #d4af37;
            margin-top: 10px;
            padding-top: 15px;
            font-size: 22px;
            font-weight: 700;
            color: #1a1a1a;
          }
          .detail-label {
            color: #666;
          }
          .detail-value {
            font-weight: 600;
            color: #1a1a1a;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="accent-bar"></div>

          <div class="header">
            <h1 class="logo">Bhendi Bazaar</h1>
            <p class="tagline">Org Payout</p>
          </div>

          <div class="success-banner">
            ✓ Payout Sent
          </div>

          <div class="content">
            <h2 class="greeting">Hello ${settlement.orgName}!</h2>

            <p class="message">
              We've sent your payout for settlement #${settlement.code}. It should reflect in your account shortly.
            </p>

            <div class="payout-details">
              <div class="detail-row">
                <span class="detail-label">Settlement</span>
                <span class="detail-value">#${settlement.code}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Paid On</span>
                <span class="detail-value">${formatShortDate(settlement.paidAt)}</span>
              </div>
              ${
                settlement.reference
                  ? `
              <div class="detail-row">
                <span class="detail-label">Reference</span>
                <span class="detail-value">${settlement.reference}</span>
              </div>
              `
                  : ""
              }
              <div class="detail-row final">
                <span>Amount</span>
                <span>${formatCurrency(paiseToRupees(settlement.amountPaise))}</span>
              </div>
            </div>

            <div class="cta-container">
              <a href="${earningsUrl}" class="button">
                View Earnings
              </a>
            </div>

            <p class="message" style="margin-top: 30px; font-size: 14px; color: #666; text-align: center;">
              Thank you for selling with Bhendi Bazaar.
            </p>
          </div>

          <div class="footer">
            <p style="font-weight: 600; color: #1a1a1a;">Questions about this payout?</p>
            <p>Contact our org support team.</p>

            <p class="copyright">
              &copy; ${new Date().getFullYear()} Bhendi Bazaar. All rights reserved.
            </p>
          </div>

          <div class="accent-bar"></div>
        </div>
      </body>
    </html>
  `;
}
