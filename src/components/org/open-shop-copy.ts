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

/** The create form's fields (own-store onboarding ux.md copy deck). */
export const OPEN_SHOP_FIELDS_COPY = {
  name: "Shop name",
  nameHint: "Buyers see this on your shop and every product.",
  namePlaceholder: "Noor Attar House",
  phone: "Your mobile number",
  phoneHint: "We'll call or message you about orders and pickups. Buyers never see it.",
  phonePlaceholder: "98765 43210",
  email: "Email for order updates",
  emailHint: "We send new orders here.",
  emailPlaceholder: "noorattar@gmail.com",
} as const;
