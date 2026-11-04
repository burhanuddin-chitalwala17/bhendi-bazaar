/** The store's and admin's chrome, in words (ADR-0067). The portal's own words are portal-copy.ts. */

export const FOOTER_COPY = {
  tagline: "The shops of Mumbai's Bhendi Bazaar, delivered across India.",
  shopNav: "Shop",
  shopHeading: "Shop",
  allShops: "All shops",
  offers: "Offers",
  sell: "Sell on Bhendi Bazaar",
  helpNav: "Help",
  helpHeading: "Help",
  contactUs: "Contact us",
  trackOrder: "Track an order",
  returns: "Returns",
  cancellations: "Cancellations",
  policiesNav: "Store policies",
  policiesHeading: "Policies",
  shipping: "Shipping",
  returnsRefunds: "Returns & refunds",
  privacy: "Privacy",
  terms: "Terms",
  grievances: "Grievances",
  legal: (year: number) => `© ${year} Bhendi Bazaar · Crafted with niyyah in Mumbai's old quarter.`,
} as const;

export const ADMIN_NAV_COPY = {
  badge: "Admin",
  overview: "Overview",
  dashboard: "Dashboard",
  orders: "Orders",
  pickups: "Pickups",
  refunds: "Refunds",
  carts: "Open carts",
  catalogue: "Catalogue",
  products: "Products",
  categories: "Categories",
  productTypes: "Product types",
  media: "Media",
  enhancements: "Photo enhancements",
  banners: "Banners",
  offers: "Offers",
  auctions: "Auctions",
  shops: "Shops",
  payouts: "Payouts",
  channels: "Channels",
  reviews: "Reviews",
  platform: "Platform",
  users: "Users",
  shippingProviders: "Shipping providers",
  fulfilmentSettings: "Fulfilment settings",
} as const;

export const TAB_BAR_COPY = {
  nav: "Primary",
  home: "Home",
  shop: "Shop",
  saved: "Saved",
  bag: "Bag",
  account: "Account",
  bagCount: (count: number) => `Bag, ${count} items`,
} as const;

/** EmailVerificationBanner.tsx */
export const EMAIL_VERIFICATION_BANNER_COPY = {
  dismiss: "Dismiss",
  pleaseVerifyYourEmailAddress: "Please verify your email address",
  resendEmail: "resend email",
  verified: "Email verified successfully!",
  verifyFailed: "Verification failed",
  sent: "Verification email sent!",
  sendFailed: "Failed to send verification email. Please try again.",
} as const;

/** FloatingAdminButton.tsx */
export const FLOATING_ADMIN_BUTTON_COPY = {
  showAdminLink: "Show admin link",
  hideAdminLink: "Hide admin link",
  admin: "Admin",
} as const;

/** PortalSidebar.tsx */
export const PORTAL_SIDEBAR_COPY = {
  openNavigation: "Open navigation",
  closeNavigation: "Close navigation",
  backToTheStore: "Back to the store",
} as const;

/** SignOutButton.tsx */
export const SIGN_OUT_BUTTON_COPY = {
  signOut: "Sign out",
  label: "Sign out",
} as const;

/** org-tab-bar.tsx */
export const ORG_TAB_BAR_COPY = {
  shop: "Shop",
  more: "More",
} as const;

/** marketplace-chrome.tsx: the bar's links after the categories. */
export const CHROME_COPY = {
  shops: "Shops",
  offers: "Offers",
} as const;
