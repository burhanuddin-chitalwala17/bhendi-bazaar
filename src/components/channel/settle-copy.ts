/**
 * Every string product-merge shows, as signed off in
 * 431ed6e7:docs/specs/marketplace-integration/product-merge/ux.md. This file is now the source (ADR-0073).
 */

export const SETTLE_ACTION = {
  addNew: "Add as new product",
  match: "Match to a product",
  leaveOff: "Leave off",
  bringBack: "Bring back",
  undo: "Undo",
  include: "Include",
  notThisOne: "Not this one",
  addProduct: "Add product",
  adding: "Adding…",
  linkAndSave: "Link and save",
  saving: "Saving…",
  matchInstead: "Match to it instead",
  backToListings: "Back to listings",
  tryAgain: "Try again",
  showAll: "Show all",
  addPhoto: "Add photo",
  stillSaving: "Still saving…",
} as const;

export const SETTLE_TOAST = {
  added: (name: string) => `Added ${name}.`,
  addedArchived: (name: string) => `Added ${name} to your Archived shelf.`,
  linked: (name: string) => `Linked to ${name}.`,
  leftOff: "Left off Bhendi Bazaar.",
  broughtBack: "Brought back.",
  failed: "Couldn't do that. Try again.",
} as const;

export const LISTINGS_SETTLE = {
  showLeftOff: (n: number) => `Show left off (${n})`,
  leftOffByYou: "Left off by you",
  leftOffEmpty: "Nothing left off. Listings you leave off Bhendi Bazaar wait here.",
  allSettled: (label: string) => `All settled. Every ${label} listing is on Bhendi Bazaar or left off.`,
  sameSku: (label: string) => `Same SKU on ${label}`,
  looksLike: (name: string) => `Looks like ${name}`,
  linkedByYou: (name: string) => `Linked by you → ${name}`,
} as const;

export const PICKER = {
  title: "Match to a product",
  search: "Search your products",
  similar: "Similar names",
  all: "All products",
  noMatch: (q: string) => `No product matches "${q}". Add it as a new product instead.`,
  loadFailed: "Couldn't load your products. Try again.",
  stillLoading: "Still loading…",
  linkedHere: (label: string) => `Already linked to another ${label} listing`,
  linkedHereWhy: (label: string) =>
    `This product is already linked to another ${label} listing. Unlink that one first, from its row on the Listings page.`,
} as const;

export const SETTLE = {
  titleNew: "Add as a new product",
  titleMatch: (name: string) => `Match to ${name}`,
  stale: (label: string, ago: string) => `As ${label} reported ${ago}.`,
  sameSkuOn: (label: string) => `Same SKU on ${label}`,
  looksLikeOn: (label: string) => `Looks like the same item on ${label}?`,
  title: "Title",
  description: "Description",
  photos: "Photos",
  moreComplete: "More complete",
  kept: "kept",
  photoCount: (n: number) => `${n} photo${n === 1 ? "" : "s"}`,
  price: "Price on Bhendi Bazaar",
  priceHelp: (parts: string) => `${parts}. Each marketplace keeps its own price.`,
  sku: "SKU for this product",
  skuBoth: "both",
  skuHelp: "Starts as the marketplace's SKU; use any you like. Each marketplace listing keeps its own SKU.",
  category: "Category",
  quantity: "How many do you actually have?",
  says: (parts: string) => `${parts}.`,
  stockSyncNote: "Amazon and Flipkart keep their own count until stock sync is on. Change it there too if it's different.",
  keptAt: "Kept at",
  inactive: (label: string) => `Inactive on ${label}, so it goes on your Archived shelf.`,
  putOnSale: "Put it on sale here",
  noDescription: "Flipkart doesn't share descriptions with us. Add one now, or later on the product.",
  noPhoto: "Add at least one photo. Flipkart doesn't share its photos with us.",
  readFailed: (label: string) => `Couldn't read this listing from ${label}. Try again in a minute.`,
  retryable: "Couldn't save. Nothing was changed. Try again.",
  loadFailed: "Couldn't read this listing. Try again in a minute.",
  stillLoading: "Still loading…",
  bhendiBazaar: "Bhendi Bazaar",
} as const;

export const PRODUCT_PHOTOS = {
  linkedByYou: "● Linked by you",
  copying: (n: number, label: string) => `Copying ${n} photo${n === 1 ? "" : "s"} from ${label}…`,
  partly: (failed: number, total: number, label: string) => `${failed} of ${total} photos couldn't be copied from ${label}.`,
} as const;
