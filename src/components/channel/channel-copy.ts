import type { ConnectResult, ConnectionError } from "@server/channels/channel-connection.types";
import { formatDate } from "@/lib/format";
import { CHANNEL, type Channel } from "@server/shared/channels";

/**
 * Every string the Channels page shows, as signed off in
 * 431ed6e7:docs/specs/marketplace-integration/channel-connectors/ux.md. This file is now the source (ADR-0073).
 */

const DAY_MONTH_YEAR: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
const DAY_MONTH: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };

export const longDate = (iso: string) => formatDate(iso, DAY_MONTH_YEAR);
export const shortDate = (iso: string) => formatDate(iso, DAY_MONTH);

export const PAGE_INTRO = "Connect a marketplace to sell there from Bhendi Bazaar.";

/** The page's two sections: where the shop can sell today, and what is being built. */
export const SECTION = {
  live: { title: "Where you sell", description: "Your shop, the feeds that show your products, and the marketplaces you can connect." },
  soon: { title: "Coming soon", description: "Being built. They appear above, ready to connect, when they open." },
} as const;

/** What each channel does for the shop, one line under its name. */
export const PURPOSE: Record<Channel, string> = {
  [CHANNEL.STORE]: "Your own shop on Bhendi Bazaar",
  [CHANNEL.GOOGLE]: "Your products in Google Shopping results",
  [CHANNEL.META]: "Your products on Facebook and Instagram",
  [CHANNEL.AMAZON]: "Listings, stock and orders with Seller Central",
  [CHANNEL.FLIPKART]: "Listings, stock and orders with Seller Hub",
  [CHANNEL.MEESHO]: "Sell to Meesho's buyers across India",
};
/** Planned channels shown under Coming soon only: not in the server's channel set until they are built. */
export const PLANNED_CHANNEL_COPY = {
  whatsapp: { label: "WhatsApp", purpose: "Share your catalogue and take orders in chats" },
  instagram: { label: "Instagram", purpose: "Tag your products in posts, reels and stories" },
} as const;
export const PAGE_LOAD_FAILED = "Couldn't load your channels. Check your connection and try again.";

export const MARKETPLACE_PITCH = (label: string) =>
  `List, update stock and get orders from your ${label} seller account.`;

export const CHIP = {
  notConnected: "Not connected",
  connected: "● Connected",
  renewBy: (iso: string) => `Renew by ${shortDate(iso)}`,
  needsReconnect: "Needs reconnecting",
  comingSoon: "Coming soon",
  full: "Full for now",
  alwaysOn: "Always on",
  feedOn: "On",
  feedOff: "Off",
} as const;

export const CARD = {
  connectedBy: (who: string | null, iso: string) => `Connected by ${who ?? "a member"} · ${longDate(iso)}`,
  disconnectedBy: (who: string | null, iso: string) => `Disconnected by ${who ?? "a member"} · ${longDate(iso)}.`,
  reapproveBy: (iso: string) => `Re-approve by ${longDate(iso)}`,
  renewalWhy: "Amazon asks sellers to re-approve apps once a year. It takes one tap; nothing is lost.",
  unavailable: (label: string) => `Connecting ${label} isn't open yet. We'll show it here when it is.`,
  full: (label: string) => `${label} allows 25 shops until it approves our app listing. We'll tell you here when it opens.`,
  storeTitle: "Your store",
} as const;

export const lastChecked = (iso: string, now = Date.now()): string => {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "Last checked just now";
  if (minutes < 60) return `Last checked ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Last checked ${hours} h ago`;
  const days = Math.round(hours / 24);
  return `Last checked ${days} day${days === 1 ? "" : "s"} ago`;
};

export const REASON: Record<ConnectionError, (label: string) => string> = {
  rejected: (label) => `${label} stopped accepting our access.`,
  expired: (label) => `${label}'s approval expired.`,
  revoked: () => "Access was removed from Seller Central.",
  other_shop: (label) =>
    `This ${label} account is already connected to another shop. An account can belong to one shop only; disconnect it there first.`,
};

export const ACTION = {
  connect: (label: string) => `Connect ${label}`,
  connecting: (label: string) => `Opening ${label}…`,
  stillWorking: "Still working…",
  renewNow: "Renew now",
  reconnect: "Reconnect",
  disconnect: "Disconnect",
  tellMeMore: "Tell me more",
  why: "Why?",
  checkNow: "Check now",
  turnOn: "Turn on",
  turnOff: "Turn off",
  viewStore: "View store",
  tryAgain: "Try again",
} as const;

export const FEED = {
  google: { off: "Show your products on Google Shopping. No account needed; Google reads your catalogue.", on: "On · your products are in Google's feed." },
  meta: { off: "Show your products on Facebook and Instagram. No account needed; Meta reads your catalogue.", on: "On · your products are in Meta's feed." },
  failed: "Couldn't change that. Try again.",
} as const;

export const DISCONNECT = {
  title: (label: string) => `Disconnect ${label}?`,
  stopsLabel: "Stops: ",
  staysLabel: "Stays: ",
  watchOutLabel: "Watch out: ",
  stops: (label: string) => `Stock, prices and orders stop updating between Bhendi Bazaar and ${label}.`,
  stays: (label: string) =>
    `Your listings on ${label} stay live as they are. Your products and their ${label} links stay here, and pick up again if you reconnect this account.`,
  watchOut: (label: string) =>
    `${label} will keep selling at the stock it last had. Pause listings in Seller Central if you don't want that.`,
  revoke: (channel: string, label: string) =>
    channel === CHANNEL.AMAZON
      ? "To remove us completely, also revoke Bhendi Bazaar in Seller Central → Apps."
      : `To remove us completely, also remove Bhendi Bazaar from your ${label} account's apps.`,
  confirm: "Disconnect",
  keep: "Keep connected",
  working: "Disconnecting…",
  done: (label: string) => `${label} disconnected.`,
  failed: "Couldn't disconnect. Try again.",
} as const;

export const CHECK_RESULT = {
  ok: "Checked just now. All good.",
  needs_reconnect: "That connection needs reconnecting.",
  unreachable: (label: string) => `${label} didn't respond. Try again in a minute.`,
} as const;

export type NoteTone = "success" | "info" | "neutral" | "warning" | "error";

/** The note shown at the top of Channels after coming back from a marketplace (ux.md). */
export const RESULT_NOTE: Record<ConnectResult, { tone: NoteTone; text: (label: string) => string; retry: boolean }> = {
  connected: { tone: "success", text: (label) => `${label} connected.`, retry: false },
  cancelled: { tone: "neutral", text: (label) => `Nothing was connected. You can connect ${label} any time.`, retry: true },
  expired: { tone: "warning", text: () => "That link has expired. Start again from here.", retry: true },
  other_session: { tone: "warning", text: () => "This connection was started from another sign-in. Start again from here.", retry: true },
  other_shop: {
    tone: "error",
    text: (label) =>
      `This ${label} account is already connected to another shop. An account can belong to one shop only; disconnect it there first.`,
    retry: false,
  },
  different_account: {
    tone: "warning",
    text: (label) =>
      `That's a different ${label} account from the one connected here. To switch accounts, disconnect this one first, then connect the new one.`,
    retry: false,
  },
  unreachable: { tone: "error", text: (label) => `${label} didn't respond. Nothing was connected. Try again in a minute.`, retry: true },
  full: { tone: "warning", text: (label) => `${label} is full for now. We'll tell you here when it opens.`, retry: false },
  unavailable: { tone: "warning", text: (label) => `Connecting ${label} isn't open yet. We'll show it here when it is.`, retry: false },
};

/** The admin's per-marketplace product types (channel-types-editor). */
export const TYPES_EDITOR = {
  saved: (label: string, typeName: string) => `Saved. ${label} types for ${typeName} updated.`,
  publishesHere: "Publishes here",
  remove: "Remove",
  nameIt: (label: string) => `Name the ${label} type to add.`,
  typeFor: (label: string, name: string) => `${label} type for ${name}`,
  add: (label: string) => `Add a ${label} type`,
  another: (label: string) => `Another ${label} type`,
} as const;

/** A value a marketplace has no word for yet (unmapped-value-row). */
export const UNMAPPED = {
  whatTheyCall: (label: string) => `What they call ${label}`,
  placeholder: "What they call it",
} as const;

/** How a product would list on each channel (listing-readiness-panel). */
export const READINESS_PANEL = {
  title: "How this would list elsewhere",
  intro: "What we expect each place to make of it. Nothing here stops you publishing — if a channel disagrees with us, it is the channel that is right.",
  listedUnder: "Listed under",
  ready: "Nothing missing",
  incomplete: "Something is missing",
  worthALook: "Worth a look",
  noCategory: "Nobody has chosen where this belongs on this channel yet.",
  nearestWithNote: (note: string) => `This is the nearest they have, not their own word for it. ${note}`,
  nearest: "This is the nearest category they have, not their own word for it.",
  missingFact: (attribute: string) => `They ask for ${attribute} and it is not answered.`,
  missingOptionalFact: (attribute: string) => `They would show ${attribute} if it were answered.`,
  missingField: (label: string, asOf: string) => `They require ${label} (their list of ${shortDate(asOf)}), and nothing here fills it yet.`,
  unmappedValue: (list: string, value: string) =>
    `They have no word for this ${list} yet — "${value}" needs one choosing, once, for every product that uses it.`,
} as const;

export const TYPES_EDITOR_SAVE_COPY = {
  failed: "Couldn't save that change. Nothing was changed.",
} as const;

export const NOT_SOLD_COPY = {
  saving: "Saving…",
  marked: "Decide where it goes",
  mark: "Not sold here",
} as const;

/** A product's completeness per channel (listing-model/dynamic-form ux copy deck). */
export const COMPLETENESS_COPY = {
  count: (channel: string, done: number, of: number) => `${channel} ${done} of ${of}`,
  ready: (channels: string[]) => `Ready for ${channels.join(", ")}`,
  missing: (channel: string, keys: string[]) => `${channel} still needs: ${keys.join(", ")}`,
} as const;
