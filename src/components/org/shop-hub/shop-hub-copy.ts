/** The Shop tab's words (own-store onboarding ux.md, State matrix — Shop hub). */
export const SHOP_HUB_COPY = {
  title: "Shop",
  help: "Your link and what buyers see",
  linkLabel: "Your shop link",
  share: "Share",
  copyLink: "Copy link",
  copied: "Link copied",
  copyFailed: "Long-press the link to copy it.",
  seeAsBuyer: "See as a buyer",
  allDone: "Everything buyers need is here.",
  rowFailed: "Couldn't load. Try again.",
  tryAgain: "Try again",
  add: "Add",
  open: "Open",
  details: "Shop details",
  page: "Shop page",
  addresses: "Pickup addresses",
  reviews: "Reviews",
  detailsToAdd: (n: number) => `Shop details · ${n === 1 ? "1 thing" : `${n} things`} to add`,
  detailsDone: "Shop details · logo and line added",
  pageShowing: (showing: number, total: number) => `Shop page · ${showing} of ${total} showing`,
  pageNotLive: "Shop page · not open to buyers yet",
  addressesNone: "Pickup addresses · none yet",
  addressesCount: (n: number) => `Pickup addresses · ${n}`,
  reviewsNone: "No reviews yet. They appear after buyers receive orders.",
  reviewsCount: (n: number) => `Reviews · ${n}`,
} as const;

/** "bhendibazaar.com/store/abc…traders": keeps both ends, so the shop's own name stays readable. */
export function truncateMiddle(text: string, max: number): string {
  if (text.length <= max) return text;
  const keep = max - 1;
  const head = Math.ceil(keep / 2);
  return `${text.slice(0, head)}…${text.slice(text.length - (keep - head))}`;
}
