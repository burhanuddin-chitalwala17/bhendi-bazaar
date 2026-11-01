import { appUrl } from "@server/shared/app-url";
import { calendarDay, indiaMoment } from "@server/shared/india-time";
import { NOTICE_KIND, type NoticeKind, type ParcelNoticeData } from "../notice.types";
import { PARCEL_ACTOR } from "@server/shipping/domain/shipping.types";
import { formatPaise } from "../formatters";
import { button, esc, paragraph, renderEmail } from "./layout";

export interface RenderedNotice {
  subject: string;
  html: string;
}

/** The shop's parcel page, never a raw courier link (Q26); the admin's order console. */
const shopLink = (d: ParcelNoticeData) => `${appUrl()}/org/${encodeURIComponent(d.orgId)}/orders/${encodeURIComponent(d.orderId)}`;
const adminLink = (d: ParcelNoticeData) => `${appUrl()}/admin/orders/${encodeURIComponent(d.orderId)}`;
const buyerLink = (d: ParcelNoticeData) => `${appUrl()}/order/${encodeURIComponent(d.orderId)}`;
const day = (value: string | undefined) => (value ? calendarDay(value) : "");
const courier = (d: ParcelNoticeData) => d.courierName || "The courier";

/** "{Who} cancelled {items}." (ux.md Emails): the buyer's own cancel, the shop's, or ours. */
function cancelledLine(d: ParcelNoticeData): string {
  if (d.cancelledBy === PARCEL_ACTOR.BUYER) return `You cancelled your items from ${d.shopName}.`;
  if (d.cancelledBy === PARCEL_ACTOR.SHOP) return `${d.shopName || "The shop"} cancelled your items.`;
  return `We cancelled your items from ${d.shopName}.`;
}

/** "3 days" — the admin's own email goes out whenever they press it, so the age is counted. */
function paidAgo(d: ParcelNoticeData): string {
  const days = Math.max(1, Math.floor((new Date(d.at ?? d.since).getTime() - new Date(d.since).getTime()) / 86_400_000));
  return days === 1 ? "a day" : `${days} days`;
}

/**
 * The fulfilment emails, worded as ux.md's Emails table has them. The data carries
 * no buyer phone or address (spec A10), so nothing here can print one.
 */
export function renderParcelNotice(kind: NoticeKind, d: ParcelNoticeData): RenderedNotice {
  switch (kind) {
    case NOTICE_KIND.READY:
      return {
        subject: `Parcel ready to book — ${d.shopName}, ${d.city}`,
        html: renderEmail({
          title: "Parcel ready to book",
          body: `
            ${paragraph(`${esc(d.parcelCode)} is packed. Book it on Shiprocket and enter the details.`)}
            ${button(adminLink(d), "Open the order")}`,
        }),
      };
    case NOTICE_KIND.READY_24H:
      return {
        subject: `Waiting 24 h: parcel ${d.parcelCode}`,
        html: renderEmail({
          title: "Parcel waiting 24 hours",
          body: `
            ${paragraph(`This parcel has been ready since ${esc(indiaMoment(new Date(d.since)))}. The shop is waiting.`)}
            ${button(adminLink(d), "Open the order")}`,
        }),
      };
    case NOTICE_KIND.NOT_READY_12H:
    case NOTICE_KIND.NOT_READY_24H:
    case NOTICE_KIND.NOT_PACKED_ADMIN: {
      const ago =
        kind === NOTICE_KIND.NOT_READY_12H ? "12 hours" : kind === NOTICE_KIND.NOT_READY_24H ? "a day" : paidAgo(d);
      return {
        subject: "1 parcel waiting to be packed",
        html: renderEmail({
          title: "1 parcel waiting to be packed",
          body: `
            ${paragraph(`${esc(d.orderCode)} was paid ${ago} ago. Tap Ready for pickup once it's packed.`)}
            ${button(shopLink(d), "Open the parcel")}`,
        }),
      };
    }
    case NOTICE_KIND.BOOKED_BUYER: {
      const track = d.trackingUrl ? `<a href="${esc(d.trackingUrl)}">${esc(d.trackingUrl)}</a>` : esc(d.trackingNumber ?? "");
      return {
        subject: `Your order ships ${day(d.pickupDate)}`,
        html: renderEmail({
          title: `Your order ships ${esc(day(d.pickupDate))}`,
          body: `
            ${paragraph(`Arrives by ${esc(day(d.estimatedDelivery))}. Track it with ${esc(courier(d))}: ${track}.`)}
            ${button(buyerLink(d), "View your order")}`,
        }),
      };
    }
    case NOTICE_KIND.BOOKED_SHOP:
      return {
        subject: `Pickup booked for ${day(d.pickupDate)}`,
        html: renderEmail({
          title: `Pickup booked for ${esc(day(d.pickupDate))}`,
          body: `
            ${paragraph(`${esc(courier(d))} will collect ${esc(d.parcelCode)}. Open the parcel to download the label.`)}
            ${button(shopLink(d), "Open the parcel")}`,
        }),
      };
    case NOTICE_KIND.PICKUP_MOVED_SHOP:
      return {
        subject: `Pickup moved to ${day(d.pickupDate)}`,
        html: renderEmail({
          title: `Pickup moved to ${esc(day(d.pickupDate))}`,
          body: `
            ${paragraph(`${esc(courier(d))} will now collect on ${esc(day(d.pickupDate))}.`)}
            ${button(shopLink(d), "Open the parcel")}`,
        }),
      };
    case NOTICE_KIND.PICKUP_MOVED_BUYER:
    case NOTICE_KIND.ETA_CHANGED_BUYER:
      return {
        subject: `New delivery date: ${day(d.estimatedDelivery)}`,
        html: renderEmail({
          title: `New delivery date: ${esc(day(d.estimatedDelivery))}`,
          body: `
            ${paragraph(`Your order now arrives by ${esc(day(d.estimatedDelivery))}.`)}
            ${button(buyerLink(d), "View your order")}`,
        }),
      };
    case NOTICE_KIND.PICKED_UP:
      return {
        subject: `${d.parcelCode} picked up`,
        html: renderEmail({
          title: `${esc(d.parcelCode)} picked up`,
          body: `
            ${paragraph(`${esc(courier(d))} has your parcel. We'll tell you when it's delivered.`)}
            ${button(shopLink(d), "Open the parcel")}`,
        }),
      };
    case NOTICE_KIND.CANCELLED_BUYER: {
      const refund = d.refundPaise ? ` Your refund of ${formatPaise(d.refundPaise)} is on its way.` : "";
      return {
        subject: `Order ${d.orderCode} cancelled`,
        html: renderEmail({
          title: `Order ${esc(d.orderCode)} cancelled`,
          body: `
            ${paragraph(`${esc(cancelledLine(d))}${esc(refund)}`)}
            ${button(buyerLink(d), "View your order")}`,
        }),
      };
    }
    case NOTICE_KIND.REFUND_STARTED_BUYER: {
      const amount = formatPaise(d.refundPaise ?? 0);
      return {
        subject: `Refund of ${amount} started`,
        html: renderEmail({
          title: `Refund of ${esc(amount)} started`,
          body: `
            ${paragraph("It reaches your account in 5–7 working days.")}
            ${button(buyerLink(d), "View your order")}`,
        }),
      };
    }
    case NOTICE_KIND.CANCELLED_SHOP: {
      const fee = d.cancelledBy === PARCEL_ACTOR.SHOP && d.feePaise ? ` ${formatPaise(d.feePaise)} cancellation fee taken from your earnings.` : "";
      return {
        subject: `Parcel ${d.parcelCode} cancelled`,
        html: renderEmail({
          title: `Parcel ${esc(d.parcelCode)} cancelled`,
          body: `
            ${paragraph(`Don't send this parcel. Its stock is back on sale.${esc(fee)}`)}
            ${button(shopLink(d), "Open the parcel")}`,
        }),
      };
    }
    case NOTICE_KIND.DELIVERED:
      return {
        subject: `Delivered: order ${d.orderCode}`,
        html: renderEmail({
          title: "Delivered",
          body: `
            ${paragraph(`Your parcel from ${esc(d.shopName)} was delivered. Hope you love it.`)}
            ${button(buyerLink(d), "View your order")}`,
        }),
      };
  }
}
