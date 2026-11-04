/** The shop portal pages' own words (ADR-0067): browser-tab titles, and the library's filter labels. */

/** Each page's `metadata.title`. */
export const ORG_PAGE_TITLES = {
  look: "Your shop's look",
  products: "Products",
  fixProducts: "Fix what is missing",
  listing: "Marketplace listing",
  newListing: "Put on a marketplace",
  shop: "Shop",
  library: "Photos",
  locations: "Pickup addresses",
  orders: "Orders",
  brands: "Brands and defaults",
  reviews: "Reviews",
  channels: "Channels",
  family: "Make one family",
  settle: "Settle listing",
  listings: "Listings",
  publish: "Review changes",
  openShop: "Open your shop",
} as const;

/** library/page.tsx: the kind and source filters. */
export const LIBRARY_FILTER_COPY = {
  photos: "Photos",
  videos: "Videos",
  youtubeLinks: "YouTube links",
  uploaded: "Uploaded",
  croppedOrMade: "Cropped or made",
  videoLink: "Video link",
} as const;
