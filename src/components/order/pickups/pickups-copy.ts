/** Admin not-packed copy, exactly as order-fulfilment ux.md signs it off. */
export const NOT_PACKED_COPY = {
  title: "Pickups",
  tab: "Not packed",
  empty: "Every paid parcel was packed within 36 hours.",
  loadFailed: "Couldn't load parcels.",
  tryAgain: "Try again",
  emailShop: "Email shop",
  sending: "Sending…",
  allShops: "All shops",
} as const;

/** "Shop emailed at 12 h and 24 h" / "+ you emailed 1 h ago" (ux.md Partial). */
export function nudgeLine(nudges: { h12: boolean; h24: boolean }, adminEmailedHoursAgo: number | null): string {
  const parts: string[] = [];
  if (nudges.h12 && nudges.h24) parts.push("Shop emailed at 12 h and 24 h");
  else if (nudges.h24) parts.push("Shop emailed at 24 h");
  else if (nudges.h12) parts.push("Shop emailed at 12 h");
  if (adminEmailedHoursAgo !== null) parts.push(`+ you emailed ${adminEmailedHoursAgo} h ago`);
  return parts.join(" ");
}

/** "Paid 3 days ago, not ready." (ux.md Stale); hours below two days. */
export function paidAgoLine(hours: number): string {
  if (hours < 48) return `Paid ${hours} h ago, not ready.`;
  return `Paid ${Math.floor(hours / 24)} days ago, not ready.`;
}

/** Over 72 h the age is red (ux.md Stale). */
export const OVERDUE_RED_HOURS = 72;

/** The Ready and Booked tabs (ux.md "admin pickups"). */
export const QUEUE_COPY = {
  ready: "Ready",
  booked: "Booked",
  empty: "No parcels waiting. You'll get an email when a shop marks one ready.",
  loadFailed: "Couldn't load pickups.",
  noCourierUpdate: "No courier update since booking.",
  allCities: "All cities",
  previous: "Previous",
  next: "Next",
  /** "Showing 51–100 of 120" (ux.md "Many items": 50 per page). */
  showing: (from: number, to: number, total: number) => `Showing ${from}–${to} of ${total}`,
} as const;

/** "Parcel 2 of 2" (ux.md Partial), from the code's "-SH2" suffix; nothing for a one-parcel order. */
export function parcelOf(code: string, of: number): string | null {
  const n = /-SH(\d+)$/.exec(code)?.[1];
  return of > 1 && n ? `Parcel ${n} of ${of}` : null;
}

/** Amber past a day ready (ux.md Stale): "Waiting 26 h" and "Ready for 26 h — book today". */
export const READY_AMBER_HOURS = 24;
export const waitingFor = (hours: number) => `Waiting ${hours} h`;
export const readyFor = (hours: number) => `Ready for ${hours} h — book today`;

/** Red once the booked pickup day has passed. */
export const pickupDue = (daysOverdue: number) =>
  daysOverdue === 1 ? "Pickup was due yesterday" : `Pickup was due ${daysOverdue} days ago`;

/** ux.md "admin book pickup". */
export const BOOKING_COPY = {
  open: "Book pickup",
  title: "Book pickup",
  hint: "Book this parcel on Shiprocket first, then copy the details here.",
  openShiprocket: "Open Shiprocket",
  save: "Save booking",
  saving: "Saving…",
  success: "Booked. Buyer and shop emailed.",
  retry: "Couldn't save. Try again.",
  refresh: "Refresh",
  fields: {
    pickupDate: "Pickup date",
    estimatedDelivery: "Delivers by",
    courierName: "Courier",
    trackingNumber: "AWB number",
    trackingUrl: "Tracking link",
    labelUrl: "Label link",
  },
} as const;

/** ux.md "admin change pickup date". */
export const DATE_COPY = {
  open: "Change pickup date",
  title: "Change pickup date",
  current: (day: string) => `Pickup was booked for ${day}. Change it on Shiprocket first.`,
  alsoCheck: "Also check the delivery date.",
  save: "Save date",
  saving: "Saving…",
  keep: "Keep date",
  success: "Pickup moved. Shop and buyer emailed.",
  retry: "Couldn't save. Try again.",
  refresh: "Refresh",
} as const;

export const PICKED_UP_COPY = {
  open: "Mark picked up",
  marking: "Marking…",
  success: "Marked picked up. The shop is emailed.",
} as const;

/** Shiprocket's own dashboard, where the admin books by hand (own-store Q18). */
export const SHIPROCKET_URL = "https://app.shiprocket.in";

/** The pickups page's Conflicts tab, as its URL names it; the error banner words itself by it. */
export const CONFLICTS_TAB = "conflicts";

/** ux.md "admin conflicts": courier updates we could not apply (R8). */
export const CONFLICT_COPY = {
  tab: "Conflicts",
  empty: "No unmatched courier updates.",
  loadFailed: "Couldn't load conflicts.",
  dismiss: "Dismiss",
  dismissing: "Dismissing…",
  dismissed: "Dismissed.",
  findParcel: "Find parcel",
  openShiprocket: "Open Shiprocket",
  showDetails: "Show details",
  /** The toggle's other face (added at build, unit 4). */
  hideDetails: "Hide details",
  loadMore: "Load more",
  unknownAwb: (awb: string, time: string) => `Update for unknown AWB ${awb} from Shiprocket at ${time}.`,
  cancelledParcel: (code: string, wording: string) =>
    `Update for cancelled parcel ${code}: courier says "${wording}". Cancel it on Shiprocket.`,
  updates: (n: number) => `${n} updates`,
  dismissedBy: (name: string) => `Dismissed by ${name}`,
} as const;
