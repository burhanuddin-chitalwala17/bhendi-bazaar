/** The shop portal's shared words (own-store onboarding D14, ux.md): "shop", never "organisation". */
export const PORTAL_COPY = {
  headerLabel: "Your shop",
  seeAsBuyer: "See as a buyer",
  pausedTitle: "Your shop is paused",
  pausedBody: "Contact us to reopen it.",
  contactUs: "Contact us",
} as const;

/** The portal's navigation words, by item key: label, the line under it, and a tab's one word. */
export const PORTAL_NAV_COPY = {
  home: { label: "Home", purpose: "What needs you today" },
  products: { label: "Products", purpose: "Add and edit what you sell" },
  orders: { label: "Orders", purpose: "Pack and track parcels" },
  shop: { label: "Shop", purpose: "Your link and what buyers see" },
  listing: { label: "Brands and defaults", purpose: "Facts every product starts with" },
  library: { label: "Photos", purpose: "All your pictures in one place" },
  storefront: { label: "Shop page", purpose: "What buyers see" },
  locations: { label: "Pickup addresses", purpose: "Where couriers collect from" },
  reviews: { label: "Reviews", purpose: "What buyers say" },
  promotions: { label: "Offers", purpose: "Discounts you run" },
  channels: { label: "Channels", purpose: "Sell on Amazon, Flipkart and more" },
  bidding: { label: "Bidding", purpose: "Auctions for one-off pieces" },
  earnings: { label: "Money you'll receive", purpose: "What you earned and when it's paid", tabLabel: "Earnings" },
  details: { label: "Shop details", purpose: "Name, contact, tax" },
  help: { label: "Help", purpose: "Ask us anything" },
} as const;

export const PORTAL_GROUP_COPY = {
  sell: "Sell",
  shop: "Your shop",
  grow: "Grow",
  money: "Money",
  settings: "Settings",
} as const;

/**
 * Every hint card and the "?" answer for each page (own-store onboarding D9), beside PORTAL_NAV,
 * whose purpose lines "?" repeats. A hint has 1–3 cards of at most two sentences (own-store Q12).
 */
export const HINT_COPY = {
  next: "Next",
  gotIt: "Got it",
  close: "Close",
  pageHelp: "What is this page for?",
  position: (index: number, total: number) => `${index} of ${total}`,
} as const;

export const PORTAL_HINT_CARDS_COPY = {
  productPhotos: "Photos sell. Use daylight and a plain wall.",
  productPrice: "Price and stock. You can change them any time.",
  address: "Couriers pick up from here. Buyers never see it.",
  look: "Your logo and one line show at the top of your shop page.",
  share: "Send your link to customers on WhatsApp. They can order without calling you.",
  productAction: "Add product",
  addressAction: "Add pickup address",
  lookAction: "Add logo and line",
  shareAction: "Share your shop",
} as const;
