import { LISTING_STATUS, type ListingField, type ListingStatusDTO } from "@server/channels/platform-listing.types";
import { formatCount, formatCurrency } from "@/lib/format";

/** channel-listings and marketplace-publish ux.md copy decks: every string the shop reads. */

export const FIELD_NAME: Record<ListingField, string> = {
  title: "Title",
  price: "Selling price",
  photos: "Photos",
  features: "Key features",
  description: "Description",
  listed: "On sale",
};

export const LISTING = {
  screenTitle: (label: string) => `${label} listing`,
  backToListings: "Listings",
  intro: (label: string) => `This is what ${label} gets. Fields marked "Same as product" follow your product; change one to make it ${label}'s own.`,
  edit: (label: string) => `Edit ${label} listing`,
  notOn: (label: string) => `Not on ${label}`,
  sameAsProduct: "Same as product",
  changedFor: (label: string) => `Changed for ${label}`,
  catalogue: (label: string) => `${label}'s catalogue`,
  productSays: (value: string) => `Product: ${value}`,
  onThereNow: (label: string, value: string) => `On ${label} now: ${value}`,
  readAgo: (ago: string) => `As read ${ago}`,
  useProducts: "Use product's",
  useProductsAll: "Use product's for all",
  takeTheirs: (label: string) => `Use ${label}'s`,
  copyOurs: "Copy ours",
  copied: "Copied",
  save: "Save",
  editProduct: "Edit product",
  sameEverywhere: "Same everywhere",
  lockedWhy: "Set on the product, so every marketplace shows the same.",
  notWritable: (where: string) => `Change it in ${where} — it takes about two days.`,
  wholeRupees: (rupees: string) => `Flipkart takes whole rupees: ${rupees} will be sent.`,
  count: (n: number, max: number) => `${formatCount(n)} of ${formatCount(max)}`,
  overLimit: (label: string, max: number, field: string) => `${label} allows ${formatCount(max)} characters; it will refuse this ${field}.`,
  photoSmall: (label: string, min: number, px: number) => `${label} wants ${min} px or more; this one is ${px} px.`,
  photoFormat: (label: string) => `${label} doesn't take this photo's format; it will be left out.`,
  photoWhite: (label: string) => `${label} wants a white background for the first photo.`,
  savedWaiting: (n: number, label: string) => (n === 0 ? "Saved. Nothing waiting." : `Saved. ${n} change${n === 1 ? "" : "s"} waiting for ${label}.`),
  saveFailed: "Couldn't save. Your changes are still here.",
  nothingWaiting: "Nothing waiting",
  waiting: (n: number) => `${n} change${n === 1 ? "" : "s"} waiting`,
  reviewAndPublish: "Review and publish",
  onSale: "On sale",
  paused: "Paused",
  addPoint: "Add a point",
  removePoint: (n: number) => `Remove key feature ${n}`,
  moveEarlier: "Move earlier",
  include: "Use this photo",
  leaveOut: "Leave this photo out",
  none: "None",
  stock: (n: number) => `${n} in stock`,
};

export const PUBLISH = {
  reviewTitle: (label: string) => `Review changes for ${label}`,
  nothingSent: "Nothing is sent until you publish.",
  empty: (label: string) => `Nothing waiting for ${label}. Changes you save on a listing show here.`,
  backToListings: "Back to listings",
  undo: "Undo",
  putBack: "Put back",
  publish: (n: number, label: string) => `Publish ${n} change${n === 1 ? "" : "s"} to ${label}`,
  create: (label: string) => `Create on ${label}`,
  nothingLeft: "Every change is undone; nothing is left to send.",
  bigChange: (from: string, to: string) => `Big change: ${from} → ${to}. Check before publishing.`,
  sentToast: (label: string) => `Sent to ${label}. Pending until it answers; we'll tell you here.`,
  failed: "Couldn't reach Bhendi Bazaar. Nothing was sent.",
  /** One line per reason a reviewed listing was not sent (marketplace-publish D3). */
  refused: {
    changed: (n: number) => `${n === 1 ? "This listing" : `${n} listings`} changed while you were reviewing. Review again.`,
    sending: (n: number, label: string) => `${n === 1 ? "This listing was" : `${n} listings were`} already sent to ${label} and ${n === 1 ? "is" : "are"} waiting for its answer. Publish again once ${label} answers.`,
    nothing: (n: number, label: string) => `${n === 1 ? "This listing has" : `${n} listings have`} nothing new for ${label}.`,
  },
  sending: (n: number, label: string) => `${n} listing${n === 1 ? " is" : "s are"} already sent to ${label}, waiting for its answer. ${n === 1 ? "It shows" : "They show"} here again once ${label} answers.`,
  pendingAnswer: (label: string) => `Sent to ${label}, waiting for its answer`,
  reviewAgain: "Review again",
  summary: (sent: number, attention: number) => `${sent} sent · ${attention} need attention`,
  bar: (n: number) => `${n} listing${n === 1 ? " has" : "s have"} changes`,
  says: (label: string) => `${label} says:`,
  general: (n: number) => `Needs attention · ${n} problem${n === 1 ? "" : "s"}`,
  tapToField: "Tap it to go to the field.",
  showingOther: (label: string, value: string) => `${label} is showing other content: ${value}`,
  checkNow: "Check now",
  showMore: "Show more",
  showAll: "Show all",
  listingsCount: (listings: number, changes: number) => `${listings} listing${listings === 1 ? "" : "s"} · ${changes} change${changes === 1 ? "" : "s"}`,
  familyPage: "Family page",
  resume: "Resume",
  pausedOn: (label: string) => `Paused on ${label}`,
  barcodeNeeded: (brand: string) => `Amazon needs a barcode or a barcode exemption for '${brand}'.`,
  barcodeHow: "Add the barcode on the product, or apply once in Seller Central → Catalogue → Apply for GTIN exemption. Then publish again.",
  addBarcode: "Add barcode",
  exemptionHow: "How to get the exemption",
  exemptionUrl: "https://sellercentral.amazon.in/gtinx",
};

/** What a marketplace says stops a listing, from the daily look (marketplace-publish Q23, ux.md "Problems"). */
export const PROBLEMS = {
  suppressed: "Suppressed",
  needsFix: "Needs a fix",
  line: (label: string, first: string, more: number) => `${label} says: ${first}${more > 0 ? ` (+${more} more)` : ""}`,
  fix: "Fix",
  filter: (n: number) => `Needs fixing ${n}`,
  home: (label: string, n: number, hidden: number) =>
    `${n} ${label} listing${n === 1 ? " needs" : "s need"} a fix${hidden > 0 ? `: ${hidden} hidden from shoppers` : ""}`,
  bannerTitle: (label: string, suppressed: boolean) => (suppressed ? `Suppressed on ${label}: shoppers can't find or buy it` : `${label} found a problem with this listing`),
  bannerHow: (label: string) => `Fix what it names below, then Review and publish. If it names something not on this page, fix it in ${label} Seller Central; we look again every day.`,
  openCentral: "Open Seller Central",
  centralUrl: "https://sellercentral.amazon.in/myinventory/inventory",
} as const;

/** "How to fix it" on a listing (marketplace-publish Q24, ux.md "Needs attention"): one line and one button per place. */
export const FIX = {
  title: "How to fix it",
  list: (names: string[]) => names.join(", "),
  brandMissing: (label: string, names: string) => `${label} needs the brand's details (${names}). This product has no brand yet.`,
  brandMissingAction: "Choose a brand",
  brand: (label: string, brand: string, names: string) => `${label} needs ${brand}'s details: ${names}.`,
  brandAction: "Fill in Brands and defaults",
  mrp: (label: string) => `${label} needs the MRP, the price printed on the tag.`,
  mrpAction: "Add the MRP",
  facts: (names: string) => `Fill these on the product: ${names}.`,
  factsAction: "Fill on product",
  admin: (label: string, names: string) => `We don't ask for ${names} yet. The admin adds them for ${label}, then you fill them on the product.`,
  after: (label: string) => `Once they're done, open Review and publish and send it to ${label} again.`,
} as const;

/** Listing as Generic, for a brand not registered on the marketplace (setup-requests Q35). */
export const GENERIC = {
  value: "Generic",
  note: (label: string) => `Your brand isn't registered on ${label}, so this lists as Generic, with no barcode. Shoppers won't see your brand name on ${label}.`,
  change: "Change in Brands and defaults",
} as const;

export const CREATE = {
  putOn: (label: string) => `Put on ${label}`,
  putFamilyOn: (label: string) => `Put the family on ${label}`,
  looking: (label: string) => `Looking for it on ${label}…`,
  found: (n: number) => `Found ${n}`,
  sellHere: "Sell on this page",
  createNew: "Create a new page",
  noneOfThese: "None of these · Create a new page",
  notFound: (label: string) => `Not found on ${label}. Create a new page for it.`,
  stillNeeds: (facts: string) => `Amazon still needs: ${facts}`,
  fillOnProduct: "Fill on product",
  category: "Amazon category",
  noCategory: "No Amazon category matches this product's type yet.",
  noBarcode: "None · we'll ask Amazon for the brand's exemption",
  reviewAndCreate: "Review and create",
  draftNote: "Nothing was created on Amazon; the draft waits here.",
  familyOf: (n: number, axis: string) => `One page with ${n} ${axis}`,
  flipkartHow: "New products are made in Flipkart Seller Hub. Once it's there, Read again links it here.",
  unreachable: (label: string) => `Couldn't reach ${label}. Try again.`,
  tryAgain: "Try again",
  matchedBy: { barcode: "matched by barcode", name: "matched by name" },
};

/** One line for where a listing stands (marketplace-publish ux.md status matrix). */
export function statusText(status: ListingStatusDTO, label: string, ago: (iso: string) => string): string {
  const when = status.at ? ago(status.at) : null;
  switch (status.status) {
    case LISTING_STATUS.DRAFT:
      return `Draft · not on ${label} yet`;
    case LISTING_STATUS.WAITING:
      return `Live · ${LISTING.waiting(status.waiting)}`;
    // Sent and Checking are one word to the shop: waiting on the marketplace (marketplace-publish Q25).
    case LISTING_STATUS.SENT:
    case LISTING_STATUS.CHECKING:
      return `Pending · waiting for ${label}'s answer`;
    case LISTING_STATUS.LIVE:
      return `Live on ${label}${when ? ` · checked ${when}` : ""}`;
    case LISTING_STATUS.PAUSED:
      return `Paused on ${label}`;
    case LISTING_STATUS.ATTENTION:
      return PUBLISH.general(status.issues);
    case LISTING_STATUS.LIVE_REFUSED:
      return "Live · your last change wasn't taken";
    case LISTING_STATUS.UNANSWERED:
      return `${label} hasn't answered. We'll look again tomorrow.`;
  }
}

/** The tone a status reads in: result words in result colours, progress in muted (publish Q4). */
export function statusTone(status: ListingStatusDTO["status"]): "success" | "info" | "muted" | "destructive" | "warning" {
  switch (status) {
    case LISTING_STATUS.LIVE:
      return "success";
    case LISTING_STATUS.WAITING:
      return "info";
    case LISTING_STATUS.ATTENTION:
    case LISTING_STATUS.LIVE_REFUSED:
      return "destructive";
    case LISTING_STATUS.DRAFT:
    case LISTING_STATUS.UNANSWERED:
      return "warning";
    default:
      return "muted";
  }
}

export const rupees = (paise: number) => formatCurrency(paise);
