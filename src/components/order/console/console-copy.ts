/** The words this area shows, one object per surface (ADR-0067). */

export const ORDER_DETAIL_ASIDE_COPY = {
  noAddressOrder: "No address on this order.",
  grandTotal: "Grand total",
  paymentId: "Payment ID",
  buyer: "Buyer",
  deliveryAddress: "Delivery address",
  orderSummary: "Order summary",
  itemsTotal: "Items total",
  shipping: "Shipping",
  discount: "Discount",
  orderDate: "Order date",
  paymentMethod: "Payment method",
  guest: "Guest",
} as const;

export const ORDERS_FILTERS_COPY = {
  search: "Search",
  anyPayment: "Any payment",
  orderCodeBuyerEmail: "Order code, buyer or email",
  searchOrders: "Search orders",
  payment: "Payment",
} as const;

export const ORDERS_TABLE_COPY = {
  orders: "Orders",
  latestOrders: "Latest orders",
  order: "Order",
  buyer: "Buyer",
  total: "Total",
  status: "Status",
  payment: "Payment",
  placed: "Placed",
  noOrdersHere: "No orders here",
  ordersMatchViewAppear: "Orders that match this view appear here.",
  noOrdersYet: "No orders yet",
  newestOrdersAppearHere: "The newest orders appear here as they are placed.",
  guest: "Guest",
} as const;

export const SHIPMENTS_PANEL_COPY = {
  parcels: "Parcels",
  nothingHasBeenPacked: "Nothing has been packed for this order yet.",
  shipping: "Shipping: ",
  items: "Items",
  trackParcel: "Track parcel",
} as const;

export const ORDER_PEEK_COPY = {
  deliverTo: "Deliver to",
  total: "Total",
  openFullOrder: "Open full order",
  closeOrder: "Close order",
  guest: "Guest",
  noAddressOrder: "No address on this order",
} as const;

export const ORDER_STATUS_COPY = {
  pendingPayment: "Awaiting payment",
  confirmed: "Confirmed",
  processing: "Processing",
  packed: "Packed",
  shipped: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
  failed: "Payment failed",
  expired: "Expired",
  unpaid: "Unpaid",
  paid: "Paid",
  paymentFailed: "Failed",
  refunded: "Refunded",
  all: "All",
} as const;
