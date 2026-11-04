/** The product console's words (ADR-0067): the list, a product's page, adding, editing, reviews. */
export const PRODUCT_CONSOLE_COPY = {
  toast: {
    deleted: "Product deleted",
    deleteFailed: "Could not delete the product",
    restored: "Product restored",
    teamSaved: (shopName: string) => `Saved. ${shopName} will see what changed.`,
  },
  view: {
    back: "Back to products",
    description: "Product details",
    seeLive: "See it live",
    edit: "Edit product",
  },
  list: {
    tabs: "Which products",
    table: "Products",
    loading: "Loading products",
    searchPlaceholder: "Search by name or SKU",
    searchLabel: "Search products",
    search: "Search",
    category: "Category",
    allCategories: "All categories",
    wishlistedOnly: "Wishlisted only",
  },
  rowMenu: {
    actionsFor: (name: string) => `Actions for ${name}`,
    view: "View",
    edit: "Edit",
    copy: "Copy product",
    restore: "Restore",
    archive: "Archive",
    delete: "Delete…",
    deleteBody: "Deleting is permanent and cannot be undone. It only works for a product nothing refers to yet — once it appears on an order, a promotion or a bidding event it is refused, because removing it would break those records. To take a product off the storefront instead, use Archive: it keeps everything and can be undone.",
    cancel: "Cancel",
    deletePermanently: "Delete permanently",
  },
  add: {
    startFrom: "Start from a product you already sell",
    copiedFrom: "Copied from",
    copiedWhat: "— description, category, details and flags. Add photos, a name, price and stock.",
    copyFrom: "Copy from product",
    copies: "Copies description, category, attributes and flags",
    searchPlaceholder: "Search by name or SKU",
    searchLabel: "Search products to copy",
    startBlank: "Start blank instead",
  },
  archived: {
    notice: "This product is archived. Restore it to edit.",
    restore: "Restore",
  },
  reviews: {
    searchPlaceholder: "Search reviews...",
    search: "Search",
    allReviews: "All reviews",
    allTypes: "All types",
    verified: "Verified purchase",
    notVerified: "Not verified",
    allRatings: "All ratings",
    stars: (rating: number) => (rating === 5 ? "5 stars" : `${rating}+ stars`),
    open: "Open review",
    ratingOnly: "No words — a rating only.",
    deletedOn: "The author deleted this on",
    keptHere: ". It is kept here and shown to nobody else.",
    restore: "Restore review",
    withdraw: "Withdraw review",
    close: "Close",
  },
} as const;

export const PRODUCT_ACTIONS_COPY = {
  created: "Product created successfully!",
  updated: "Product updated successfully!",
  restoreFailed: "Could not restore the product",
  archived: "Product archived",
  restored: "Product restored",
  archiveFailed: "Could not archive the product",
} as const;

export const PRODUCTS_LIST_EMPTY_COPY = {
  noneTitle: "No products yet",
  noneBody: "Add your first product and it goes on sale in your shop.",
  add: "Add a product",
  filteredTitle: "Nothing here",
  filteredBody: "No product matches this view. Try another tab or search.",
} as const;

export const PRODUCT_ADD_HEADER_COPY = {
  back: "Back to products",
  teamTitle: "Add product for this shop",
  title: "Add product",
} as const;

export const PRODUCT_EDIT_HEADER_COPY = {
  backTeam: "Back to product",
  back: "Back to products",
} as const;

export const REVIEW_STATE_COPY = {
  deleted: "Deleted by author",
  withdrawn: "Withdrawn",
  published: "Published",
} as const;

export const REVIEWS_TABLE_TOAST_COPY = {
  updated: "Review updated",
} as const;

export const PRODUCT_SHELF_COPY = {
  all: "All",
  lowStock: "Low stock",
  soldOut: "Sold out",
  archived: "Archived",
  live: "Live",
} as const;
