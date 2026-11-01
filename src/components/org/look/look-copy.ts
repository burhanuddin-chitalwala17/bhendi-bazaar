import { LOOK_OWNER_ONLY } from "@server/catalog/storefront-look.types";

/** The look picker's words (storefront-themes ux.md: picker, preview & publish, copy deck). */
export const LOOK_COPY = {
  title: "Your shop's look",
  intro: "Choose how your shop looks. You can change it any time.",
  liveNow: "Live now",
  preview: "Preview",
  previewUnavailable: "Preview unavailable",
  previewFailed: "Couldn't load your preview.",
  themesFailed: "Couldn't load your themes. Check your internet.",
  tryAgain: "Try again",
  ownerOnly: LOOK_OWNER_ONLY,
  back: "Back",
  addProduct: "Add a product",
  palette: "Palette",
  landing: "Landing",
  shop: "Shop",
  publishThisLook: "Publish this look",
  publishTitle: (theme: string) => `Publish ${theme}?`,
  publishBody: "Your shop will look like this for everyone. You can switch back any time.",
  publish: "Publish",
  notYet: "Not yet",
  publishing: "Publishing…",
  published: "Your new look is live.",
  shareShop: "Share your shop",
  notPublished: (current: string) => `Not published. Your shop still shows ${current}.`,
  seeIt: "See it",
  publishAnyway: "Publish mine anyway",
  switchBack: (previous: string) => `Switch back to ${previous}`,
  switchBackTitle: (previous: string) => `Switch back to ${previous}?`,
  switchBackBody: "Your shop will look like this for everyone again.",
  switchBackConfirm: "Switch back",
  switchingBack: "Switching back…",
  switchedBack: (previous: string) => `Switched back to ${previous}.`,
  notSwitched: (current: string) => `Not switched. Your shop still shows ${current}.`,
} as const;

/** ux.md preview & publish, Slow: the button shows its spinner after this long, and stays tappable. */
export const SLOW_AFTER_MS = 1_000;
