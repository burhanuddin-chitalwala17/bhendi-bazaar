import { CONNECTION_ERROR, type ConnectResult, type ConnectionError } from "@server/channels/channel-connection.types";
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
  [CHANNEL.META]: "Your products in Facebook and Instagram shops, from your catalogue feed.",
  [CHANNEL.AMAZON]: "Listings, stock and orders with Seller Central",
  [CHANNEL.FLIPKART]: "Listings, stock and orders with Seller Hub",
  [CHANNEL.MEESHO]: "Sell to Meesho's buyers across India",
};
/** Planned channels shown under Coming soon only: not in the server's channel set until they are built. */
export const PLANNED_CHANNEL_COPY = {
  whatsapp: { label: "WhatsApp", purpose: "Show your catalogue in chats and message your customers" },
  instagram: { label: "Instagram", purpose: "Post your products and answer comments and DMs" },
} as const;
/** The Why? sheet on a planned social card (meta-foundation ux.md, copy deck). */
export const PLANNED_WHY = {
  open: "Why?",
  openLabel: (label: string) => `Why is ${label} coming soon?`,
  title: (label: string) => `${label} is coming soon`,
  body: "We're finishing Meta's checks so every shop can connect safely. When it opens it appears above, ready to connect.",
  done: "Got it",
  close: "Close",
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
  removed_in_app: (label) => `Bhendi Bazaar was removed inside ${label}, so the connection stopped.`,
  offboarded: () => "Your WhatsApp Business app was set up on another phone, so the connection stopped.",
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

/** The feed card's own name beside the Instagram card (connect-instagram Q13): two names for two jobs. */
export const META_CATALOGUE_TITLE = "Meta catalogue";

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
  personal: {
    tone: "warning",
    text: () =>
      "That's a personal Instagram account. Bhendi Bazaar works with business and creator accounts, which are free. In Instagram: Profile → ☰ → Account type and tools → Switch to professional account.",
    retry: true,
  },
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

/**
 * The Instagram card, its checklist, the Turn on replies sheet, its return notes and its disconnect
 * dialog, as signed off in docs/specs/social-selling/connect-instagram/ux.md.
 */
export const INSTAGRAM = {
  purpose: "Post, answer comments and DMs, and turn comments into sales.",
  needsProfessional: "Needs an Instagram business or creator account (free to switch).",
  beforeConsent: "Instagram will ask to let Bhendi Bazaar manage messages. That's what lets you reply from here. Your chats stay between you and your buyers.",
  account: (username: string, kind: string | null) => `@${username}${kind ? ` · ${kind}` : ""}`,
  kind: { business: "Business", creator: "Creator" },
  needsYou: "Needs you",
  messagesOff: "Replies from here are off in Instagram. Switch them back on to answer DMs here.",
  showMeHow: "Show me how",
  checking: "Checking…",
  /** Removed inside Instagram says so; every other lost access is Instagram refusing us. */
  reason: (code: ConnectionError | null) =>
    code === CONNECTION_ERROR.REMOVED_IN_APP ? "Bhendi Bazaar was removed in Instagram's settings." : "Instagram stopped accepting our access.",
  steps: {
    connect: "Connect",
    replies: "Turn on replies",
    first_post: "First post",
    comment_dm: "Comment-to-DM",
  },
  stepsLabel: "Setup",
  waiting: "waiting for your first message",
  checkItNow: (username: string) => `To check it now, send @${username} a DM from another account.`,
  setupDone: "Setup done",
  sheet: {
    title: "Turn on replies from Bhendi Bazaar",
    body: "So you can answer your DMs here, Instagram asks you to switch this on once, in the app:",
    steps: [
      "1. Settings → Messages and story replies",
      "2. Message controls → Connected tools",
      "3. Turn on Allow access to messages",
    ],
    privacy: "🔒 Private to your shop · No one at Bhendi Bazaar reads your chats.",
    open: "Open Instagram",
    done: "Done",
    close: "Close",
    failed: "Couldn't save that. Try again.",
  },
  disconnect: {
    stops: "scheduled posts won't publish, and new comments and DMs stop arriving here.",
    stays: "your posts on Instagram stay as they are.",
    revoke: "To remove us completely, also remove Bhendi Bazaar in Instagram: Settings → Website permissions → Apps and websites.",
  },
} as const;

/** Connect WhatsApp's button and the lines around Meta's pop-up (connect-whatsapp ux.md "Opening Meta"). */
export const WHATSAPP = {
  connect: "Connect WhatsApp",
  opening: "Opening Meta…",
  finishInMeta: "Finish in the Meta window…",
  beforeConsent:
    "Meta will ask to let Bhendi Bazaar manage your WhatsApp messages. That's what lets you reply from here. Your chats stay between you and your buyers.",
} as const;

/** Instagram's own app or site: on a phone the link opens the app where it is installed. */
export const INSTAGRAM_APP_URL = "https://www.instagram.com/";

/** The note at the top of Channels after coming back from Instagram (connect-instagram ux.md "Return note"). */
export const INSTAGRAM_RESULT_NOTE: Record<ConnectResult, { tone: NoteTone; text: string; action: "replies" | "connect" | "retry" | "disconnect" | null }> = {
  connected: { tone: "success", text: "Instagram connected. Next: turn on replies, so you can answer DMs from here.", action: "replies" },
  personal: {
    tone: "warning",
    text: "That's a personal Instagram account. Bhendi Bazaar works with business and creator accounts, which are free. In Instagram: Profile → ☰ → Account type and tools → Switch to professional account.",
    action: "retry",
  },
  cancelled: { tone: "neutral", text: "Nothing was connected. You can connect Instagram any time.", action: "connect" },
  expired: { tone: "warning", text: "That link has expired. Start again from here.", action: "connect" },
  other_session: { tone: "warning", text: "That link has expired. Start again from here.", action: "connect" },
  other_shop: {
    tone: "error",
    text: "This Instagram account is already connected to another shop. An account can belong to one shop only; disconnect it there first.",
    action: null,
  },
  different_account: {
    tone: "warning",
    text: "That's a different Instagram account from the one connected here. To switch, disconnect this one first, then connect the new one.",
    action: "disconnect",
  },
  unreachable: { tone: "error", text: "Instagram didn't respond. Nothing was connected. Try again in a minute.", action: "retry" },
  full: { tone: "warning", text: "Connecting Instagram isn't open yet. We'll show it here when it is.", action: null },
  unavailable: { tone: "warning", text: "Connecting Instagram isn't open yet. We'll show it here when it is.", action: null },
};
