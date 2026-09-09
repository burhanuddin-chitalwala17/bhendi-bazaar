import { baseEmailStyles } from "./styles/baseEmailStyles";
import { formatCurrency, formatDate } from "../formatters";
import { appUrl } from "@server/shared/app-url";

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
 * This is the message that actually makes an auction an auction: without it a bidder
 * bids once and never learns they lost the lead (bidding spec R28). It deliberately
 * leads with both numbers and the deadline, because those are the three things that
 * decide whether the reader comes back.
 *
 * It names no other bidder — who is leading is never public, only what they bid
 * (spec R16).
 */
export function getOutbidEmailTemplate(view: OutbidEmailView): string {
  const bidUrl = `${appUrl()}/bid/${view.slug}`;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>You have been outbid - Bhendi Bazaar</title>
        <style>
          ${baseEmailStyles}

          .bid-compare {
            display: table;
            width: 100%;
            margin: 24px 0;
            border-collapse: separate;
            border-spacing: 8px 0;
          }
          .bid-cell {
            display: table-cell;
            width: 50%;
            padding: 16px;
            border-radius: 12px;
            text-align: center;
            vertical-align: middle;
          }
          .bid-cell.theirs { background: #f4f4f5; }
          .bid-cell.leading { background: #ecfdf5; }
          .bid-label {
            display: block;
            font-size: 11px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: #71717a;
            margin-bottom: 6px;
          }
          .bid-value {
            display: block;
            font-size: 22px;
            font-weight: 700;
            color: #18181b;
          }
          .bid-cell.leading .bid-value { color: #047857; }
          .deadline {
            margin: 20px 0 4px;
            padding: 12px 16px;
            border-radius: 10px;
            background: #fffbeb;
            color: #92400e;
            font-size: 14px;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="accent-bar"></div>

          <div class="header">
            <h1 class="logo">Bhendi Bazaar</h1>
            <p class="tagline">You have been outbid</p>
          </div>

          <div class="content">
            <h2 class="greeting">Hello ${view.bidderName}!</h2>

            <p class="message">
              Someone has bid more than you on <strong>${view.productName}</strong>.
              You are no longer the highest bidder.
            </p>

            <div class="bid-compare">
              <div class="bid-cell theirs">
                <span class="bid-label">Your bid</span>
                <span class="bid-value">${formatCurrency(view.theirBidPaise)}</span>
              </div>
              <div class="bid-cell leading">
                <span class="bid-label">Leading bid</span>
                <span class="bid-value">${formatCurrency(view.currentBidPaise)}</span>
              </div>
            </div>

            <div class="deadline">
              Bidding closes ${formatDate(view.endAt)}
            </div>

            <p class="message">
              There is still time to take the lead back.
            </p>

            <div class="cta-container">
              <a href="${bidUrl}" class="button">Place a higher bid</a>
            </div>

            <p class="link-text">
              Or open this link: <br>
              <span class="alternate-link">${bidUrl}</span>
            </p>
          </div>

          <div class="footer">
            <p class="copyright">&copy; ${new Date().getFullYear()} Bhendi Bazaar</p>
          </div>
        </div>
      </body>
    </html>
  `;
}
