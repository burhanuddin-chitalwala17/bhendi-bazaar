import { APP_NAME } from "@/lib/config";
/** The words this area shows, one object per surface (ADR-0067). */

export const DOWNLOAD_BILL_BUTTON_COPY = {
  downloadBill: "Download bill",
  downloadBillPdf: "Download bill (PDF)",
} as const;

export const ORDER_CLIENT_COPY = {
  everyUpdate: "Every update ",
  needHelpOrder: "Need help with this order?",
  contactUs: "Contact us",
  parcelProgress: "Parcel progress",
  awaitingPayment: "Awaiting payment",
  confirmed: "Confirmed",
  beingPacked: "Being packed",
  packed: "Packed",
  onItsWay: "On its way",
  delivered: "Delivered",
  cancelled: "Cancelled",
  paymentFailed: "Payment failed",
  yourOrders: "Your orders",
  shipped: "Shipped",
  outDelivery: "Out for delivery",
  trackParcel: "Track parcel",
} as const;

export const ORDER_LOOKUP_COPY = {
  orderId: "Order ID",
  findOrder: "Find order",
  enterOrderIdFirst: "Enter your order ID first.",
  trackOrder: "Track an order",
  enterOrderIdFrom: "Enter the order ID from your confirmation email.",
  eGBb7kq4mnzp: "e.g. BB-7KQ4MNZP",
} as const;

export const ORDER_SUMMARY_COPY = {
  subtotal: "Subtotal",
  delivery: "Delivery",
  offers: "Offers",
  total: "Total",
  razorpay: "Razorpay",
  stripe: "Stripe",
  paid: "Paid",
  failed: "Failed",
  pending: "Pending",
} as const;

export const ORDERS_CLIENT_COPY = {
  yourOrders: "Your orders",
  searchOrders: "Search your orders",
  searchOrderIdName: "Search by order ID or name",
  noOrdersMatch: "No orders match",
  tryOrderIdFrom: "Try the order ID from your confirmation email.",
  noOrdersYet: "No orders yet",
  oncePlaceOrderShows: "Once you place an order, it shows up here with every parcel's progress.",
  account: "Account",
  startShopping: "Start shopping",
} as const;

export const BUYER_CANCEL_COPY = {
} as const;

/** order-fulfilment ux.md "buyer order". */
export const BUYER_COPY = {
  arrivesBy: (day: string) => `Arrives by ${day}`,
  track: ORDER_CLIENT_COPY.trackParcel,
  parcels: (n: number) => `Arriving in ${n} parcels`,
} as const;

export const ORDER_SHARE_COPY = {
  title: (code: string) => `Order ${code} - ${APP_NAME}`,
  text: `Check out my order from ${APP_NAME}`,
} as const;

export const ORDER_HEADLINE_COPY = {
  placedTitle: "Thank you — your order is confirmed",
  placedBody: "We'll keep this page up to date as your parcels move.",
  pendingTitle: "Waiting for your payment",
  pendingBody: "Your items are held while the payment completes.",
  failedTitle: "Your payment didn't go through",
  failedBody: "Nothing was charged. You can try again from your cart.",
  expiredTitle: "This checkout has expired",
  expiredBody: "It wasn't paid in time, so the items were released. Nothing was charged.",
  shippedTitle: "Your order is on its way",
  shippedBody: "Track each parcel below.",
  deliveredTitle: "Delivered",
  deliveredBody: "We hope you love it.",
  cancelledTitle: "This order was cancelled",
  cancelledBody: "Any refund due is shown below.",
} as const;

export const ORDER_API_COPY = {
  notFound: "Order not found",
  lookupFailed: "Failed to lookup order",
} as const;
