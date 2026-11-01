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
