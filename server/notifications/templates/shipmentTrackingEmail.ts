import { baseEmailStyles } from "./styles/baseEmailStyles";

/** What this template renders — one row per booked parcel, its real courier reference. */
export interface ShipmentTrackingEmailView {
  id: string;
  code: string;
  customerName: string;
  shipments: Array<{
    trackingNumber?: string;
    trackingUrl?: string;
    courierName?: string;
  }>;
}

export function getShipmentTrackingEmailTemplate(order: ShipmentTrackingEmailView): string {
  const hasMultiple = order.shipments.length > 1;

  const shipmentRowsHtml = order.shipments
    .map(
      (shipment, index) => `
                <div class="shipping-address" style="margin: 15px 0;">
                  ${hasMultiple ? `<div class="address-title">📦 Parcel ${index + 1} of ${order.shipments.length}</div>` : ""}
                  <div class="address-content">
                    ${shipment.courierName ? `<strong>Courier:</strong> ${shipment.courierName}<br>` : ""}
                    ${shipment.trackingNumber ? `<strong>Tracking number:</strong> ${shipment.trackingNumber}<br>` : ""}
                    ${
                      shipment.trackingUrl
                        ? `<a href="${shipment.trackingUrl}" class="button" style="display: inline-block; margin-top: 10px;">Track this parcel</a>`
                        : ""
                    }
                  </div>
                </div>`
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your order has shipped #${order.code} - Bhendi Bazaar</title>
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
          .shipping-address {
            background: #f8f8f8;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #d4af37;
          }
          .address-title {
            font-weight: 700;
            font-size: 16px;
            color: #1a1a1a;
            margin-bottom: 12px;
          }
          .address-content {
            font-size: 14px;
            line-height: 1.8;
            color: #4a4a4a;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="accent-bar"></div>

          <div class="header">
            <h1 class="logo">Bhendi Bazaar</h1>
            <p class="tagline">Royal Curation of Islamic Clothing</p>
          </div>

          <div class="success-banner">
            🚚 Your order is on its way!
          </div>

          <div class="content">
            <h2 class="greeting">Hello ${order.customerName}!</h2>

            <p class="message">
              Order #${order.code} has shipped. Here's how to track it:
            </p>

            ${shipmentRowsHtml}

            <p class="message" style="margin-top: 30px; font-size: 14px; color: #666; text-align: center;">
              Thank you for choosing Bhendi Bazaar. We appreciate your business!
            </p>
          </div>

          <div class="footer">
            <p style="font-weight: 600; color: #1a1a1a;">Questions or Concerns?</p>
            <p>Our support team is here to help you.</p>
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
