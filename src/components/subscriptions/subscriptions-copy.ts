import { FEATURE, FEATURE_LABEL, type Feature } from "@server/subscriptions/feature-access.types";

/** Every word of the paid-feature locks, from ux.md's copy deck (subscriptions/feature-access, ADR-0067). */

/** A feature's name as the shop reads it; declared once beside the closed set. */
export const FEATURE_NAME: Record<Feature, string> = FEATURE_LABEL;

export const PLAN_TAB_COPY = {
  tab: "Plan",
  lead: "What this shop pays for. Changes apply on the shop's next screen.",
  covers: {
    [FEATURE.CHANNELS]: "Amazon, Flipkart, Google and Meta: publish, stock sync, orders, feeds.",
    [FEATURE.STOREFRONT]: "The shop's own page, to share on WhatsApp and Instagram.",
    [FEATURE.IMAGE_ENHANCEMENT]: "Photos made ready for every platform.",
  },
  on: (date: string, by: string) => `On · since ${date} · by ${by}`,
  off: (date: string, by: string) => `Off · since ${date} · by ${by}`,
  neverSwitched: "Off · not switched on yet",
  homeBrand: (shop: string) => `${shop} is the home brand. Every feature stays on.`,
  someone: "an admin",
  switchLabel: (feature: string) => `${feature} for this shop`,
} as const;

export const TURN_OFF_COPY = {
  title: (feature: string, shop: string) => `Turn off ${feature} for ${shop}?`,
  what: {
    [FEATURE.CHANNELS]: "Publishing, stock sync, orders and feeds stop. Live listings stay up, but their stock stops updating and may oversell.",
    [FEATURE.STOREFRONT]: "Their link shows 'not yet available' and the store leaves search.",
    [FEATURE.IMAGE_ENHANCEMENT]: "No new enhancements. Photos already in the queue still finish.",
  },
  kept: "Nothing the shop has set up is deleted.",
  confirm: "Turn off",
  keep: "Keep on",
} as const;

export const SWITCH_TOAST_COPY = {
  off: (feature: string, shop: string) => `${feature} off for ${shop}`,
  on: (feature: string, shop: string) => `${feature} on for ${shop}`,
  failed: (feature: string) => `Couldn't change ${feature}. Try again.`,
  already: (feature: string, on: boolean) => `${feature} was already ${on ? "on" : "off"}.`,
} as const;

export const LOCK_COPY = {
  locked: "Locked",
  partOfPlan: (feature: string) => `${feature} is part of the ₹699 plan`,
  bannerLine: (feature: string) => `${feature} is part of the ₹699 plan.`,
  value: {
    [FEATURE.CHANNELS]: "List once on Amazon, Flipkart, Google and Meta, with one stock count everywhere.",
    [FEATURE.STOREFRONT]: "Your own shop page to share on WhatsApp, cards and Instagram.",
    [FEATURE.IMAGE_ENHANCEMENT]: "Phone photos made ready for every platform.",
  },
  price: "₹699 a month, GST included. Everything you've set up stays.",
  talkToUs: "Talk to us",
  notNow: "Not now",
  prefill: (feature: string, shop: string) => `Hi, I'd like ${feature} for ${shop}.`,
  notSyncing: "Not syncing: Channels is off.",
  marketplaceOrdersLocked: "Orders from Amazon and Flipkart show here once Channels is on.",
  enhancementPaused: "Paused: Image enhancement is off",
} as const;

export const FORM_CHANNELS_LOCKED_COPY =
  "These are for Amazon, Flipkart, Google and Meta. Fill them now and your listings are ready when Channels is on.";

export const STOREFRONT_LOCKED_COPY = {
  memberBanner: "Only your team sees this. Your link shows 'not yet available' until Storefront is on.",
  closedTitle: (shop: string) => `${shop} isn't open here yet`,
  closedBody: "Their products are on Bhendi Bazaar.",
  browse: "Browse Bhendi Bazaar",
} as const;
