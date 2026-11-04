/** Words for shared/ (ADR-0067): one object per component file, kept byte-identical to what it showed. */

/** PageError.tsx */
export const PAGE_ERROR_COPY = {
  somethingWentWrongOnOur: "Something went wrong on our side",
  homePage: "home page",
} as const;

/** ShareButton.tsx */
export const SHARE_BUTTON_COPY = {
  share: "Share",
} as const;

/** ShareDialog.tsx */
export const SHARE_DIALOG_COPY = {
  share: "Share",
  linkCopiedPasteItIn: "Link copied — paste it in your Instagram post or story",
} as const;

/** image-lightbox.tsx */
export const IMAGE_LIGHTBOX_COPY = {
  closeFullView: "Close full view",
} as const;

/** image-upload.tsx */
export const IMAGE_UPLOAD_COPY = {
  thumbnail: "Thumbnail",
  uploadImage: "Upload Image",
  maxImages: (max: number) => `Maximum ${max} images allowed`,
} as const;

/** load-more.tsx */
export const LOAD_MORE_COPY = {
  tryAgain: "Try again",
  showMore: "Show more",
} as const;

/** paginated-product-grid.tsx */
export const PAGINATED_PRODUCT_GRID_COPY = {
  tryAgain: "Try again",
  showMore: "Show more",
  thatIsEverything: "That is everything.",
} as const;

/** product-card.tsx */
export const PRODUCT_CARD_COPY = {
  soldOut: "Sold out",
} as const;

/** product-grid.tsx */
export const PRODUCT_GRID_COPY = {
  loadingProducts: "Loading products",
} as const;

/** product-sort-select.tsx */
export const PRODUCT_SORT_SELECT_COPY = {
  sortProducts: "Sort products",
} as const;

/** resource-list.tsx */
export const RESOURCE_LIST_COPY = {
  theListDidnTLoad: "The list didn't load. Nothing was changed.",
  previousPage: "Previous page",
  nextPage: "Next page",
  rows: "Rows",
  emptyTitle: "Nothing here yet",
  emptyBody: "Rows appear here as soon as there are any.",
  clearSelection: "Clear selection",
  selectAll: "Select all",
} as const;

/** selection-bar.tsx */
export const SELECTION_BAR_COPY = {
  selection: "Selection",
  moreActions: "More actions",
  clearSelection: "Clear selection",
} as const;

export const PAGINATED_GRID_COPY = {
  loadFailed: "Could not load more. Check your connection and try again.",
  loading: "Loading more products",
  noun: "products",
  shown: (count: number, noun: string) => `${count} ${noun} shown`,
} as const;

export const STOCK_STATUS_COPY = {
  soldOut: "Sold out",
  inStock: "In stock",
  onlyLeft: (stock: number) => `Only ${stock} left`,
} as const;

export const SHARE_DIALOG_LINK_COPY = {
  copied: "Copied",
  copy: "Copy link",
} as const;

export const ERROR_STATE_COPY = {
  title: "Something went wrong",
  retry: "Try again",
} as const;
