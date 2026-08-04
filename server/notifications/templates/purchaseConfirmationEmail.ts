import type { Order } from "@/domain/order";
import { baseEmailStyles } from "./styles/baseEmailStyles";
import { formatCurrency, formatDate } from "../formatters";

export function getPurchaseConfirmationEmailTemplate(order: Order): string {
  // Generate order items HTML
  const orderItemsHtml = order.itemsTotal

  // Tracking URL
  const trackingUrl = `${process.env.NEXTAUTH_URL}/order/${order.id}`;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Confirmation #${order.code} - Bhendi Bazaar</title>
        <style>
          ${baseEmailStyles}
          
          /* Additional styles for purchase confirmation */
          .success-banner {
            background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
            color: white;
            padding: 20px 30px;
            text-align: center;
            font-size: 18px;
            font-weight: 600;
          }
          .order-details {
            background: #f8f8f8;
            border: 2px solid #d4af37;
            border-radius: 8px;
            padding: 20px;
            margin: 25px 0;
          }
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
          .items-header th:last-child {
            text-align: right;
          }
          .totals-section {
            background: #f8f8f8;
            padding: 20px;
            border-radius: 8px;
            margin: 25px 0;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            font-size: 15px;
          }
          .total-row.final {
            border-top: 2px solid #d4af37;
            margin-top: 10px;
            padding-top: 15px;
            font-size: 20px;
            font-weight: 700;
            color: #1a1a1a;
          }
          .total-label {
            color: #666;
          }
          .total-value {
            font-weight: 600;
            color: #1a1a1a;
          }
          .shipping-address {
            background: #f8f8f8;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #d4af37;
            margin: 25px 0;
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
            ✓ Order Confirmed! Thank you for your purchase
          </div>
          
          <div class="content">
            <h2 class="greeting">Hello ${order.address.fullName}! 🎉</h2>
            
            <p class="message">
              Thank you for shopping with Bhendi Bazaar! Your order has been confirmed and is being processed.
            </p>
            
            <p class="message">
              We'll send you another email once your order has been shipped with tracking information.
            </p>
            
            <div class="order-details">
              <div class="order-details-header">
                <div>
                  <div class="order-number">Order #${order.code}</div>
                </div>
                <div class="order-date">${formatDate(new Date(order.createdAt))}</div>
              </div>
              
              <div class="order-info-grid">
                <div class="info-item">
                  <div class="info-label">Payment Status</div>
                  <div class="info-value" style="color: ${order.paymentStatus === "paid" ? "#22c55e" : "#f59e0b"};">
                    ${order.paymentStatus === "paid" ? "✓ Paid" : "Pending"}
                  </div>
                </div>
                <div class="info-item">
                  <div class="info-label">Order Status</div>
                  <div class="info-value" style="color: #2563eb;">
                    ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                  </div>
                </div>
                ${
    order.shipments.length > 0
                    ? `
                <div class="info-item">
                  <div class="info-label">Estimated Delivery</div>
                  <div class="info-value">${order.shipments[0].estimatedDelivery ? formatDate(new Date(order.shipments[0].estimatedDelivery)) : "N/A"}</div>
                </div>
                `
                    : ""
                }
              </div>
            </div>
            
            <h3 style="font-size: 18px; margin-top: 30px; margin-bottom: 15px; color: #1a1a1a;">
              Order Items
            </h3>
            
            <table class="items-table">
              <thead class="items-header">
                <tr>
                  <th>Product</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${orderItemsHtml}
              </tbody>
            </table>
            
            <div class="totals-section">
              <div class="total-row">
                <span class="total-label">Subtotal:</span>
                <span class="total-value">${formatCurrency(order.itemsTotal)}</span>
              </div>
              ${
    order.discount > 0
                  ? `
              <div class="total-row">
                <span class="total-label">Discount:</span>
                <span class="total-value" style="color: #22c55e;">-${formatCurrency(order.discount)}</span>
              </div>
              `
                  : ""
              }
              <div class="total-row final">
                <span>Total:</span>
                <span>${formatCurrency(order.grandTotal)}</span>
              </div>
            </div>
            
            <div class="shipping-address">
              <div class="address-title">📦 Shipping Address</div>
              <div class="address-content">
                <strong>${order.address.fullName}</strong><br>
                ${order.address.addressLine1}<br>
                ${order.address.addressLine2 ? `${order.address.addressLine2}<br>` : ""}
                ${order.address.city}, ${order.address.state} ${order.address.pincode}<br>
                ${order.address.country}<br>
                <br>
                📱 ${order.address.mobile}
                ${order.address.email ? `<br>✉️ ${order.address.email}` : ""}
              </div>
            </div>
            
            ${
              order.notes
                ? `
            <div class="shipping-address">
              <div class="address-title">📝 Order Notes</div>
              <div class="address-content">${order.notes}</div>
            </div>
            `
                : ""
            }
            
            <div class="cta-container">
              <a href="${trackingUrl}" class="button">
                Track Your Order
              </a>
            </div>
            
            <div class="help-section">
              <p><strong>Need Help?</strong></p>
              <p>If you have any questions about your order, please contact our support team.</p>
              <p style="margin-top: 10px;">
                <strong>Order Code:</strong> ${order.code}
              </p>
            </div>
            
            <p class="message" style="margin-top: 30px; font-size: 14px; color: #666; text-align: center;">
              Thank you for choosing Bhendi Bazaar. We appreciate your business!
            </p>
          </div>
          
          <div class="footer">
            <p style="font-weight: 600; color: #1a1a1a;">Questions or Concerns?</p>
            <p>Our support team is here to help you.</p>
            
            <div class="social-links">
              <a href="#" class="social-link">Contact Us</a> •
              <a href="#" class="social-link">Track Order</a> •
              <a href="#" class="social-link">Returns Policy</a>
            </div>
            
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