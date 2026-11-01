import { formatCurrency } from "@/lib/format";

/** order-fulfilment ux.md "admin fee setting and cancellation count", exactly as signed off. */
export const FEE_COPY = {
  title: "Fulfilment settings",
  label: "Shop cancellation fee (₹)",
  hint: "Taken from a shop's earnings when it cancels a paid parcel. Applies to the next cancellation.",
  save: "Save",
  saving: "Saving…",
  saved: (rupees: number) => `Saved. New cancellations charge ₹${rupees}.`,
  retry: "Couldn't save. Try again.",
  refresh: "Refresh",
  lastChanged: (name: string, day: string) => `Last changed by ${name}, ${day}`,
  countsTitle: "Cancellations by shop, last 30 days",
  noCancels: "No shop has cancelled a parcel yet.",
  countRow: (shop: string, count: number, feesPaise: number) =>
    `${shop} · ${count} cancelled · ${formatCurrency(feesPaise)} fees`,
  loadMore: "Load more",
} as const;
