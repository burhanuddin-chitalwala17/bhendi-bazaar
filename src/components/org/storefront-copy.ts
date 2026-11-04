/** The shop page editor: its address and look, the banner list, the add-a-banner drawer and its preview (ADR-0067). */
export const STOREFRONT_EDITOR_COPY = {
  sectionStory: "About the shop",
  sectionBrands: "Brands you carry",
  sectionPolicies: "Delivery and returns",
  sectionSocial: "Ways to follow you",
  saved: "Storefront saved.",
  address: "Your address",
  addressHint: "This is the link you share. It works on a card, in a message, or in an advertisement.",
  open: "Open",
  savedTogether:
    "Everything below is saved together by the button at the end. Your logo, the line about your shop and everything buyers read about you are on",
  shopDetails: "Shop details",
  look: "Your shop's look",
  cover: "Cover image — the picture at the top of your About page",
  leaveOut: "What to leave out",
  leaveOutHint:
    "Anything you have written is yours to withhold. What buyers said, what you have sold and the goods themselves are not switched off here — those are their account of you, not your claim about yourself.",
  hide: (section: string) => `Hide “${section}”`,
  save: "Save storefront",
} as const;

export const BANNERS_COPY = {
  deleted: "Banner deleted.",
  stillSaving: "Saving the last change…",
  title: "Banners",
  intro: "Cards that run across the top of your shop — a picture, a line of words, and somewhere to go. Add more than one and they rotate.",
  appliesNow: "Changes here apply straight away",
  notSaved: "— they are not part of the Save button below.",
  live: "Live",
  down: "Down",
  moveUp: (label: string) => `Move ${label} up`,
  moveDown: (label: string) => `Move ${label} down`,
  delete: (label: string) => `Delete ${label}`,
} as const;

export const ADD_BANNER_COPY = {
  shopNow: "Shop now",
  added: "Banner added — it is live on your shop now.",
  open: "Add banner",
  title: "Add a banner",
  description: "It goes live on your shop as soon as you add it.",
  close: "Close",
  titleField: "Title (optional)",
  titlePlaceholder: "Eid collection",
  line: "A line underneath (optional)",
  linePlaceholder: "New ridas, in store now",
  href: "Where it points (optional)",
  hrefHint:
    "Paste the link to your shop or to one of your products — straight from the address bar is fine. Leave it blank for a promotion that is not a link. With no words at all, the picture shows on its own.",
  picture: "Picture (optional)",
  cancel: "Cancel",
  adding: "Adding…",
  submit: "Add banner",
} as const;

export const BANNER_PREVIEW_COPY = {
  label: "Preview",
  heading: "How it will look",
  desktop: "Desktop and tablet",
  phone: "Phone",
  noPicture: "No picture yet: the banner shows on your shop's plain colour.",
} as const;

/** Changing the shop's address (storefront R4g): every consequence, before confirming. */
export const HANDLE_CHANGE_COPY = {
  changed: "Your shop has a new address.",
  open: "Change address",
  title: "Change your shop's address",
  currentlyAt: "Your shop is at",
  today: "today.",
  field: "New address",
  fieldPlaceholder: "naaz-collection",
  before: "Before you change it",
  keepsWorking: " keeps working until",
  thenStops: ", then stops.",
  mayBeTaken: "After that it may be given to another shop — an old link could take your customers somewhere else.",
  updatePrinted: "Update anything already printed, paid for or posted: cards, signage, advertisements, your social profiles.",
  search: "Search results for the old address will not fully carry over to",
  theNewOne: "the new one",
  keep: (handle: string) => `Keep ${handle}`,
  changing: "Changing…",
  submit: "Change the address",
} as const;
