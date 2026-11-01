/** The create screen's words (own-store onboarding ux.md: Create your shop, copy deck). */
export const OPEN_SHOP_COPY = {
  title: "Open your shop",
  lead: "Two things now; the rest when you need it.",
  link: (url: string) => `Your link: ${url}`,
  submit: "Create my shop",
  submitting: "Opening your shop…",
  slow: "Still opening… don't close this page.",
  retryable: "Couldn't open your shop. Check your internet and try again.",
  retry: "Try again",
  opened: "Your shop is open",
  signIn: "Sign in to open your shop.",
} as const;

/** How long a create may run before the screen says it is still working (ux Slow). */
export const SLOW_AFTER_MS = 3000;

/** The handle's room after the store prefix on a 360px phone; cut in the middle beyond it (ux Long content). */
export const LINK_PREVIEW_MAX = 24;
