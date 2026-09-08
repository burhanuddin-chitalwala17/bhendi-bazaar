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

/** One purchased line, as it stood at the time of the order. */
export interface OrderEmailLineItem {
  name: string;
  quantity: number;
  unitPrice: number; // paise
  totalPrice: number; // paise
  size?: string;
  color?: string;
}

/** What this template renders — the caller maps its row onto this, whatever its source. */
export interface OrderEmailView {
  id: string;
  code: string;
  status: string;
  paymentStatus: string | null;
  createdAt: Date;
  notes?: string | null;
  items: OrderEmailLineItem[];
  itemsTotal: number; // paise
  discount: number; // paise
  grandTotal: number; // paise
  address: {
    fullName: string;
    email?: string;
    mobile: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  shipments: Array<{ estimatedDelivery?: string | null }>;
}

/** Only what this email adds to the shared sheet — the line-item table and its callouts. */
const purchaseStyles = `
          .order-details-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 15px;
            border-bottom: 2px solid #d4af37;
          }
          .order-number {
            font-size: 18px;
            font-weight: 700;
            color: #1a1a1a;
          }
          .order-date {
            font-size: 14px;
            color: #666;
          }
          .order-info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-top: 15px;
          }
          .info-item {
            font-size: 14px;
          }
          .info-label {
            color: #666;
            margin-bottom: 4px;
          }
          .info-value {
            color: #1a1a1a;
            font-weight: 600;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 25px 0;
            border: 1px solid #e5e5e5;
            border-radius: 8px;
            overflow: hidden;
          }
          .items-header {
            background: #1a1a1a;
            color: white;
          }
          .items-header th {
            padding: 15px;
            text-align: left;
            font-weight: 600;
            font-size: 14px;
            letter-spacing: 0.5px;
          }
          .items-header th:not(:first-child) {
            text-align: right;
          }
          .items-table td {
            padding: 15px;
            border-top: 1px solid #e5e5e5;
            font-size: 14px;
            color: #1a1a1a;
          }
          .items-table td:not(:first-child) {
            text-align: right;
          }
          .item-name {
            font-weight: 600;
          }
          .item-variant {
            font-size: 12px;
            color: #666;
            margin-top: 2px;
          }
          .item-qty, .item-price {
            color: #666;
          }
          .item-total {
            font-weight: 600;
          }
          .callout {
            background: #f8f8f8;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #d4af37;
            margin: 25px 0;
          }
          .callout-title {
            font-weight: 700;
            font-size: 16px;
            color: #1a1a1a;
            margin-bottom: 12px;
          }
          .callout-content {
            font-size: 14px;
            line-height: 1.8;
            color: #4a4a4a;
          }
          .help-section {
            background: #fff9e6;
            border: 1px solid #d4af37;
            border-radius: 8px;
            padding: 20px;
            margin: 25px 0;
            text-align: center;
          }
          .help-section p {
            color: #8b7123;
            margin-bottom: 10px;
          }
          .help-section strong {
            color: #1a1a1a;
          }
          @media only screen and (max-width: 600px) {
            .order-info-grid {
              grid-template-columns: 1fr;
            }
            .order-details-header {
              flex-direction: column;
              align-items: flex-start;
              gap: 10px;
            }
          }
`;

function renderItemRows(items: OrderEmailLineItem[]): string {
  return items
    .map((item) => {
      const variant = [
        item.size ? `Size: ${esc(item.size)}` : null,
        item.color ? `Color: ${esc(item.color)}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      return `
                <tr>
                  <td>
                    <div class="item-name">${esc(item.name)}</div>
                    ${variant ? `<div class="item-variant">${variant}</div>` : ""}
                  </td>
                  <td class="item-qty">${item.quantity}</td>
                  <td class="item-price">${formatPaise(item.unitPrice)}</td>
                  <td class="item-total">${formatPaise(item.totalPrice)}</td>
                </tr>`;
    })
    .join("");
}

function renderOrderSummary(order: OrderEmailView): string {
  const paid = order.paymentStatus === "paid";
  const delivery = order.shipments[0]?.estimatedDelivery;

  return `
            <div class="panel">
              <div class="order-details-header">
                <div><div class="order-number">Order #${esc(order.code)}</div></div>
                <div class="order-date">${formatDate(new Date(order.createdAt))}</div>
              </div>

              <div class="order-info-grid">
                <div class="info-item">
                  <div class="info-label">Payment Status</div>
                  <div class="info-value" style="color: ${paid ? "#22c55e" : "#f59e0b"};">
                    ${paid ? "✓ Paid" : "Pending"}
                  </div>
                </div>
                <div class="info-item">
                  <div class="info-label">Order Status</div>
                  <div class="info-value" style="color: #2563eb;">
                    ${esc(order.status.charAt(0).toUpperCase() + order.status.slice(1))}
                  </div>
                </div>
                ${
                  order.shipments.length > 0
                    ? `
                <div class="info-item">
                  <div class="info-label">Estimated Delivery</div>
                  <div class="info-value">${delivery ? formatDate(new Date(delivery)) : "N/A"}</div>
                </div>
                `
                    : ""
                }
              </div>
            </div>`;
}

function renderAddress(address: OrderEmailView["address"]): string {
  return `
            <div class="callout">
              <div class="callout-title">📦 Shipping Address</div>
              <div class="callout-content">
                <strong>${esc(address.fullName)}</strong><br>
                ${esc(address.addressLine1)}<br>
                ${address.addressLine2 ? `${esc(address.addressLine2)}<br>` : ""}
                ${esc(address.city)}, ${esc(address.state)} ${esc(address.pincode)}<br>
                ${esc(address.country)}<br>
                <br>
                📱 ${esc(address.mobile)}
                ${address.email ? `<br>✉️ ${esc(address.email)}` : ""}
              </div>
            </div>`;
}

export function getPurchaseConfirmationEmailTemplate(order: OrderEmailView): string {
  const totals: DetailRow[] = [
    { label: "Subtotal:", value: formatPaise(order.itemsTotal) },
    ...(order.discount > 0
      ? [
          {
            label: "Discount:",
            value: `<span style="color: #22c55e;">-${formatPaise(order.discount)}</span>`,
          },
        ]
      : []),
    { label: "Total:", value: formatPaise(order.grandTotal), final: true },
  ];

  return renderEmail({
    title: `Order Confirmation #${order.code}`,
    banner: "✓ Order Confirmed! Thank you for your purchase",
    styles: purchaseStyles,
    body: `
            ${greeting(`Hello ${order.address.fullName}! 🎉`)}

            ${paragraph(
              "Thank you for shopping with Bhendi Bazaar! Your order has been confirmed and is being processed."
            )}

            ${paragraph(
              "You can check your order's status at any time using the link below."
            )}

            ${renderOrderSummary(order)}

            <h3 style="font-size: 18px; margin-top: 30px; margin-bottom: 15px; color: #1a1a1a;">
              Order Items
            </h3>

            <table class="items-table">
              <thead class="items-header">
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>${renderItemRows(order.items)}
              </tbody>
            </table>

            ${detailPanel(totals, "plain")}

            ${renderAddress(order.address)}

            ${
              order.notes
                ? `
            <div class="callout">
              <div class="callout-title">📝 Order Notes</div>
              <div class="callout-content">${esc(order.notes)}</div>
            </div>
            `
                : ""
            }

            ${button(`${appUrl()}/order/${order.id}`, "View Order")}

            <div class="help-section">
              <p><strong>Need Help?</strong></p>
              <p>If you have any questions about your order, please contact our support team.</p>
              <p style="margin-top: 10px;"><strong>Order Code:</strong> ${esc(order.code)}</p>
            </div>

            ${closingNote("Thank you for choosing Bhendi Bazaar. We appreciate your business!", "center")}`,
    footer: {
      heading: "Questions or Concerns?",
      note: "Our support team is here to help you.",
      links: [
        { label: "Contact Us", href: "#" },
        { label: "View Order", href: "#" },
        { label: "Returns Policy", href: "#" },
      ],
    },
  });
}
