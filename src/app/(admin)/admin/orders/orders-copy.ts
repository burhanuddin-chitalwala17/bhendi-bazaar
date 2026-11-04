/** The admin's order pages (ADR-0067). */
export const ADMIN_ORDERS_COPY = {
  pickupsMetaTitle: "Pickups",
  title: "Orders",
  description: "Every order on the platform, newest first.",
  exportCsv: "Export CSV",
  statusTabs: "Order status",
  eyebrow: "Order",
  back: "Orders",
  pickupsDescription: "Parcels to book with a courier, pickups booked, and parcels a shop hasn't packed.",
  pickupsTabs: "Pickups",
  refundsTitle: "Refunds",
  refundsDescription: (owed: number) => `${owed} owed, oldest first. Started refunds follow.`,
} as const;
