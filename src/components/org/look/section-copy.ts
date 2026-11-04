import { SECTION, type SectionKey } from "@server/catalog/storefront-themes";
import { PREVIEW_COPY } from "@/components/storefront/preview/preview-copy";

/** The section sheet's words (storefront-themes ux.md: section sheet, preview & publish). */
export const SECTION_COPY = {
  tapToChange: "Tap any part to change it.",
  addPhoto: PREVIEW_COPY.addPhoto,
  heroPhotosHelp: "Up to 3 photos. The first one is what WhatsApp shows.",
  emptyHelp: "Leave it empty and this part draws a pattern.",
  heroLine: "One line under your name",
  uploading: "Uploading…",
  notUploaded: (n: number) => `${n} ${n === 1 ? "photo" : "photos"} didn't upload.`,
  tryAgain: "Try again",
  addPhotoButton: "Add photo",
  photo: "Photo",
  removePhoto: "Remove photo",
  save: "Save",
  saving: "Saving…",
  saved: "Saved",
  saveFailed: "Couldn't save. Your words are kept here.",
  load: "Load",
  keepMine: "Keep mine",
  loadFailed: "Couldn't load your shop's details.",
  searchCategories: "Search your categories",
  collectionsHelp: "Pick up to 6 of your categories. A photo for each is optional.",
  noCategories: "Your categories show here once you add products.",
  claimsHelp: "Pick up to three. Buyers see them apart from what Bhendi Bazaar knows about you.",
  claimDetail: "One line about it (optional)",
  hoursOpen: "Opens at",
  hoursClose: "Closes at",
  hoursClosedOn: "Closed on",
  clearHours: "Remove hours",
  addHours: "Add opening hours",
  hide: "Hide this section",
  hiddenStub: PREVIEW_COPY.hidden,
  shopDetails: "Edit on Shop details",
  storyHelp: "\"About your shop\" and the person behind it are on Shop details.",
  visitHelp: "Your area is on Shop details. Buyers reach you through \"Contact us\", never your phone.",
} as const;

/** Each editable section's sheet title. */
export const SECTION_TITLE: Partial<Record<SectionKey, string>> = {
  [SECTION.HERO]: "Top of your page",
  [SECTION.COLLECTIONS]: "Collections",
  [SECTION.WHY_BUY]: "Why buy from us",
  [SECTION.STORY]: "Your story",
  [SECTION.VISIT]: "Visit & contact",
};

/** ux.md section sheet, Long content: the counter shows from 80% of the limit. */
export const COUNTER_FROM = 0.8;
/** ux.md section sheet, Slow: the button's spinner after this long. */
export const SAVE_SLOW_AFTER_MS = 3_000;
/** ux.md section sheet, Many items: the category search shows past this many. */
export const SEARCH_CATEGORIES_FROM = 8;
