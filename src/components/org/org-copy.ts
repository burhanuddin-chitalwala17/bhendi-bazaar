/** Small shop-portal surfaces: the shop switcher, the brand page standing, listing defaults (ADR-0067). */
export const ORG_SWITCHER_COPY = {
  shop: "Shop",
  switchLabel: (name: string) => `Shop: ${name}. Switch shop`,
  current: "Current shop",
  openAnother: "Open another shop",
} as const;

export const BRAND_STANDING_COPY = {
  heading: "What your page shows",
  count: (showing: number, total: number) => `${showing} of ${total} showing`,
  turnedOff: "You have turned this off, so buyers do not see it.",
  waitingOn: (what: string) => `Waiting on ${what}.`,
  addIt: "Add it",
  showing: "Showing",
  hidden: "Hidden",
  waiting: "Waiting",
} as const;

export const LISTING_DEFAULTS_COPY = {
  saved: "Defaults saved",
  country: "Country of origin",
  countryHint: "Where your products are made, unless a brand or a product says otherwise",
  taxRate: "Tax rate (%)",
  taxRatePlaceholder: "e.g. 18",
  taxRateHint: "The GST rate most of your products carry",
  taxCodes: "Tax code by category",
  noCategories: "Categories appear here once you have products in them.",
  taxCodePlaceholder: "HSN code",
} as const;

/** The portal's way in when no shop is named: none yet, or a choice of several. */
export const ORG_PICKER_COPY = {
  noneTitle: "You are not part of a shop yet",
  noneBody: "Selling on Bhendi Bazaar happens through a shop. Ask a shop owner to add you to theirs, or open your own.",
  open: "Open your shop",
  backToStore: "Back to Store",
  chooseTitle: "Choose a shop",
  chooseBody: "You work for more than one. Pick the one you want to work on.",
  openAnother: "+ Open another shop",
} as const;

export const LISTING_DEFAULTS_SAVE_COPY = {
  saving: "Saving…",
  save: "Save defaults",
} as const;
