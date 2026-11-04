/** The shop portal pages' own headers, where no surface's copy module already says them (ADR-0067). */
export const ORG_PAGES_COPY = {
  shopPageTitle: "Shop page",
  shopPageDescription: "Your own page on Bhendi Bazaar, and the link you share.",
  offersTitle: "Offers",
  offersDescription:
    "Your own offers, on your own goods. You bear what they cost — and if the platform runs something deeper, it pays the difference rather than you.",
  newOffer: "New offer",
  newOfferDescription: (capPercent: number) =>
    `You bear what this costs, up to ${capPercent}%. If the platform runs something deeper on the same item, it pays the difference.`,
  editOffer: "Edit offer",
  editOfferDescription: "Changes apply from now on. Discounts already given keep the terms they were given under.",
  listingTitle: "Brands and defaults",
  listingDescription:
    "The brands you carry and the facts every product starts from. Nothing here is needed to sell today; each fact you save is one you stop typing per product.",
  brands: "Brands",
  defaults: "Defaults",
  biddingTitle: "Bidding",
  biddingDescription:
    "Put one item up for timed bidding and share the link. While it runs, that item stays on the site but cannot be bought directly.",
  newBidding: "Set up bidding",
  bulkTitle: "Add many at once",
  bulkDescription: "One sheet and a folder of photos",
  locationsTitle: "Pickup addresses",
  locationsDescription: "Where couriers collect from",
  libraryTitle: "Photos",
  libraryDescription: "Every photo and video your shop has, where each is used, and what can go.",
} as const;

/** What each portal page's loading skeleton announces to a screen reader. */
export const ORG_LOADING_COPY = {
  shopPage: "Loading your shop page",
  photos: "Loading your photos",
  offers: "Loading your offers",
  earnings: "Loading your earnings",
  locations: "Loading pickup addresses",
  auctions: "Loading auctions",
  listing: "Loading brands and defaults",
  reviews: "Loading reviews",
  publish: "Loading what will be sent",
  product: "Loading the product",
} as const;

/** The heading of each portal page's own error boundary. */
export const ORG_ERROR_COPY = {
  orders: "Orders didn't load",
  channels: "Channels didn't load",
  listing: "The listing didn't load",
  listings: "Listings didn't load",
  looks: "Looks didn't load",
} as const;

export const ORG_CHANNELS_PAGE_COPY = {
  title: "Channels",
} as const;
