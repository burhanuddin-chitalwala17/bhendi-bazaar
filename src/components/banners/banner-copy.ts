/** The admin's banner screens: list, form and their pages (ADR-0067). */
export const BANNER_PAGE_COPY = {
  listTitle: "Banners",
  listDescription: "The storefront hero, top to bottom in the order shoppers see it.",
  add: "Add banner",
  back: "Banners",
  newTitle: "New banner",
  newDescription: "It appends to the end of the hero; reorder from the list.",
  editTitle: "Edit banner",
} as const;

export const BANNER_FORM_COPY = {
  saved: "Banner saved",
  eyebrow: "Eyebrow",
  eyebrowHint: "The small line above the headline.",
  eyebrowPlaceholder: "The Abaya Edit",
  headline: "Headline",
  headlineHint: "Leave it blank for artwork that already carries its own words — the banner then shows the picture alone, with no shading over it.",
  headlinePlaceholder: "Cut for the everyday…",
  description: "Description",
  descriptionHint: "Two lines on a phone, three on desktop — anything longer is clipped.",
  picture: "Background picture",
  imageAlt: "Image description",
  imageAltHint: "What the picture shows, for a shopper using a screen reader.",
  buttons: "Buttons",
  buttonLabel: "Label",
  buttonLabelPlaceholder: "Shop Abayas",
  destination: "Destination",
  // What an admin will actually paste. Stored as the path, so the origin never reaches the database.
  destinationPlaceholder: "https://bhendi-bazaar.com/category/abayas",
  style: "Style",
  styleFilled: "Filled",
  styleOutlined: "Outlined",
  removeButton: (n: number) => `Remove button ${n}`,
  addButton: "Add button",
  live: "Live on the storefront",
  liveHint: "Turn off to take it down without losing it.",
  save: "Save banner",
} as const;

export const BANNER_LIST_COPY = {
  emptyTitle: "No banners yet",
  emptyDescription: "The storefront hero is empty until you add one.",
  moveUp: (label: string) => `Move ${label} up`,
  moveDown: (label: string) => `Move ${label} down`,
  live: "Live",
  down: "Down",
  reupload: "Image needs re-uploading",
  buttons: (n: number) => `${n} button${n === 1 ? "" : "s"}`,
  toggle: (isActive: boolean, label: string) => `${isActive ? "Take down" : "Publish"} ${label}`,
  edit: (label: string) => `Edit ${label}`,
  delete: (label: string) => `Delete ${label}`,
  confirmTitle: "Delete this banner?",
  confirmBody: (label: string) =>
    `“${label}” and its buttons are removed for good. Taking it down with the switch keeps the copy and artwork for next time.`,
  keep: "Keep it",
  confirmDelete: "Delete banner",
} as const;
