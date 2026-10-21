import { formatCurrency } from "@/lib/format";
import {
  LISTING_STATUS,
  READ_ERROR,
  READ_STATE,
  type ChannelReadDTO,
  type ListingStatus,
} from "@server/channels/channel-connection.types";

/**
 * Every string the Listings page, the card's reading line and the product's "On marketplaces" block
 * show, as signed off in docs/specs/marketplace-integration/channel-import/ux.md. Edit there first.
 */

/** A read older than this reads as stale (ux.md "Stale"). */
const STALE_MS = 2 * 24 * 60 * 60_000;

const ago = (iso: string, now: number): string => {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

const of = (read: ChannelReadDTO) => `${read.done ?? 0} of ${read.total ?? "?"}`;

export type ReadLine = { text: string; tone: "muted" | "warning" | "error"; running: boolean };

/** The one line that says where a read is, on the Listings page (ux.md "State matrix — Listings page"). */
export function pageReadLine(read: ChannelReadDTO, label: string, hasRows: boolean, now = Date.now()): ReadLine | null {
  if (read.state === READ_STATE.RUNNING) {
    return { text: hasRows ? `Reading… ${of(read)}` : `Reading your listings… ${of(read)}`, tone: "muted", running: !read.stalled };
  }
  if (read.state === READ_STATE.STOPPED) {
    if (read.error === READ_ERROR.AUTH) return { text: READ_REFUSED.auth(label), tone: "error", running: false };
    if (read.error === READ_ERROR.OTHER_SHOP) return { text: READ_REFUSED.otherShop(label), tone: "error", running: false };
    if (read.error === READ_ERROR.DIFFERENT_ACCOUNT) return { text: READ_REFUSED.differentAccount(label), tone: "error", running: false };
    return { text: `Reading stopped at ${of(read)}. ${label} is busy; we'll try again in a few minutes.`, tone: "warning", running: false };
  }
  if (read.state === READ_STATE.DONE && read.finishedAt) {
    const stale = now - new Date(read.finishedAt).getTime() > STALE_MS;
    return { text: `Read ${ago(read.finishedAt, now)}`, tone: stale ? "warning" : "muted", running: false };
  }
  return null;
}

/** The card's line (ux.md "State matrix — Marketplace card (additions only)"). */
export function cardReadLine(
  read: ChannelReadDTO | null,
  listings: { total: number; linked: number } | null,
  label: string,
): ReadLine | null {
  if (!read) return null;
  if (read.state === READ_STATE.RUNNING) return { text: `Reading your listings… ${of(read)}`, tone: "muted", running: !read.stalled };
  if (read.state === READ_STATE.STOPPED) {
    if (read.error === READ_ERROR.DIFFERENT_ACCOUNT) return { text: READ_REFUSED.differentAccount(label), tone: "error", running: false };
    if (read.error === READ_ERROR.BUSY) {
      return { text: `Reading stopped at ${of(read)}. We'll pick up where it left off.`, tone: "warning", running: false };
    }
    return null;
  }
  if (read.state === READ_STATE.DONE && listings) {
    return { text: `${listings.total} listings · ${listings.linked} linked`, tone: "muted", running: false };
  }
  return null;
}

export const READ_REFUSED = {
  auth: (label: string) => `${label} stopped accepting our access, so we can't read your listings. Reconnect on Channels.`,
  otherShop: (label: string) =>
    `This ${label} account is already connected to another shop. An account can belong to one shop only; disconnect it there first.`,
  differentAccount: (label: string) =>
    `That's a different ${label} account from the one connected here. To switch accounts, disconnect this one first, then connect the new one.`,
} as const;

export const LISTINGS = {
  title: (label: string) => `${label} listings`,
  seeListings: "See listings",
  readAgain: "Read again",
  readingAgain: "Reading again…",
  goToChannels: "Go to Channels",
  empty: (label: string) => `Your ${label} account has no listings yet. When you add some on ${label}, tap Read again.`,
  lastReported: (label: string) => `As ${label} last reported`,
  search: "Search title or SKU",
  tabLinked: (n: number) => `Linked ${n}`,
  tabNotLinked: (n: number) => `Not linked ${n}`,
  showMore: "Show more",
  stillLoading: "Still loading…",
  noMatches: "No listings match that search.",
  flipkartUngrouped:
    "Flipkart doesn't say which listings are sizes of one item. You'll group them when adding products.",
  loadFailed: "Couldn't load these listings. Check your connection and try again.",
} as const;

export const ROW = {
  skuLine: (sku: string, idName: string, id: string | null) => (id ? `SKU ${sku} · ${idName} ${id}` : `SKU ${sku}`),
  linkedBySku: (name: string) => `Linked by SKU → ${name}`,
  archivedHere: "Archived here",
  notOnBb: "Not on Bhendi Bazaar yet",
  unlinkedByYou: "Unlinked by you",
  gone: (label: string) => `No longer on ${label}`,
  group: (title: string, count: number, axis: string | null, label: string) =>
    `${title} · ${count} ${axis ? axisNoun(axis, count) : count === 1 ? "variant" : "variants"} on ${label}`,
  groupAxis: (axis: string) => `by ${axis}`,
  unlink: "Unlink",
  linkBack: "Link back",
  undo: "Undo",
  unlinked: "Unlinked. It won't be linked again automatically.",
  linkedTo: (name: string) => `Linked to ${name}.`,
  failed: "Couldn't do that. Try again.",
} as const;

/** "size" → "4 sizes"; anything with "and" in it stays "4 variants". */
function axisNoun(axis: string, count: number): string {
  if (axis.includes(" and ")) return count === 1 ? "variant" : "variants";
  return count === 1 ? axis : `${axis}s`;
}

export const STATUS_TEXT: Record<ListingStatus, string> = {
  [LISTING_STATUS.LIVE]: "Live",
  [LISTING_STATUS.INACTIVE]: "Inactive",
  [LISTING_STATUS.INCOMPLETE]: "Incomplete",
};

/** "₹1,899 · 9 in stock", read-only (ux.md "Price and stock"). */
export function priceAndStock(pricePaise: number | null, quantity: number | null): string | null {
  const parts = [
    pricePaise !== null ? formatCurrency(pricePaise) : null,
    quantity !== null ? `${quantity} in stock` : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export const PANEL = {
  on: (label: string) => `On ${label}`,
  onBb: "On Bhendi Bazaar",
  image: "Image",
  title: "Title",
  sku: "SKU",
  status: "Status",
  price: "Price",
  stock: "Stock",
  different: "Different",
  archived: "Archived",
  notOnBb: "Not on Bhendi Bazaar yet. You'll add or match it in the next step.",
  wasLinkedTo: (name: string) => `Was linked to ${name}`,
  changesNothing: "Linking changes nothing on your product.",
  settledLater: (label: string) => `Differences are settled when you set up this product's ${label} listing.`,
  close: "Close",
  none: "—",
} as const;

export const ON_MARKETPLACES = {
  title: "On marketplaces",
  linkedBySku: "● Linked by SKU",
  notLinked: "Not linked",
  gone: (label: string) => `No longer on ${label}`,
  needsReconnect: (label: string) => `${label} needs reconnecting; this is what it last reported`,
  seeListing: "See listing",
  goToChannels: "Go to Channels",
} as const;

/** What a marketplace calls its own listing id. */
export const ID_NAME: Record<string, string> = { amazon: "ASIN", flipkart: "FSN" };
