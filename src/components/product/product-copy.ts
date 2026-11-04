/** The buyer's product page words (ADR-0067): details, gallery, buying, delivery and reviews. */
export const PRODUCT_PAGE_COPY = {
  details: {
    reviewCount: (count: number) => (count === 1 ? "1 review" : `${count} reviews`),
    noReviews: "No reviews yet — write the first",
    inclusiveOfTaxes: "Inclusive of all taxes",
    alsoAvailable: "Also available",
    payBy: "Pay by UPI, card, net banking or wallet",
    returns: "Return within 7 days of delivery",
    heading: "Product details",
    questions: "Questions about this product?",
    contactUs: "Contact us",
  },
  gallery: {
    previous: "Previous image",
    next: "Next image",
    hoverToZoom: "Hover to zoom",
    touchHint: "Swipe to navigate • Pinch to zoom",
  },
  buy: {
    inBidding: "This is up for bidding, so it can't be bought directly right now.",
    goToBidding: "Go to bidding",
    buyNow: "Buy now",
  },
  delivery: {
    deliversTo: "Delivers to",
    arrivesBy: "· arrives by",
    noDeliveryTo: "This shop doesn't deliver to",
    noDeliveryYet: "yet.",
    change: "Change",
    title: "Check delivery",
    placeholder: "6-digit PIN code",
    check: "Check",
  },
  similar: {
    title: "You may also like",
    description: "Pieces from nearby lanes",
  },
  reviews: {
    overline: "Bazaar whispers",
    title: "Customer reviews",
    description: "What buyers say once it has arrived.",
    empty: "No reviews yet. If you have bought this, yours would be the first — what it is like once it arrives is what the next buyer is trying to find out.",
  },
  video: {
    quality: "Video quality",
    unavailable: "This video is no longer available",
  },
} as const;

/** Writing, listing and deleting a review (review-form, review-list, review-photo-picker). */
export const REVIEW_COPY = {
  form: {
    updated: "Your review is updated",
    live: "Thanks — your review is live",
    signInReason: "Sign in to post your review",
    stars: (star: number) => `${star} ${star === 1 ? "star" : "stars"}`,
    yourRating: "Your rating",
    headline: "Headline",
    headlinePlaceholder: "Sums it up in a line",
    yourReview: "Your review",
    reviewPlaceholder: "Is it as described? How is the quality? Is the colour true to the photographs?",
    photos: "Photos",
    saving: "Saving…",
    saveChanges: "Save changes",
    posting: "Posting…",
    post: "Post review",
    cancel: "Cancel",
    signInFirst: "You will be asked to sign in before it posts. What you have written stays here.",
  },
  list: {
    deleted: "Your review is deleted",
    deleteFailed: "Could not delete your review.",
    verifiedPurchase: "Verified purchase",
    edit: "Edit",
    delete: "Delete",
    loading: "Loading…",
    readMore: (left: number) => `Read more reviews (${left} left)`,
    confirmTitle: "Delete this review?",
    confirmBody: "It comes off the product page and out of its rating. This cannot be undone — your other reviews of this product are untouched.",
    keep: "Keep it",
    deleting: "Deleting…",
    confirm: "Delete review",
  },
  photos: {
    tooMany: (max: number) => `A review can carry ${max} photos.`,
    uploadFailed: "That photo would not upload. The rest of your review is safe.",
    added: "Photo you added to this review",
    remove: "Remove this photo",
    uploading: "Uploading…",
    add: "Add a photo of what arrived",
    hint: (max: number) => `Up to ${max} photos of it as it arrived. Yours, shown inside your review.`,
  },
} as const;

export const BUY_ACTIONS_LABEL_COPY = {
  soldOut: "Sold out",
  add: "Add to bag",
} as const;

export const DELIVERY_CHECK_ERROR_COPY = {
  invalid: "Enter a 6-digit PIN code.",
  failed: "Couldn't check just now. Try again in a moment.",
} as const;

export const REVIEW_LIST_ERROR_COPY = {
  loadMore: "Could not load more reviews. Please try again.",
} as const;

export const REVIEWS_ACTION_COPY = {
  write: "Write a review",
  first: "Be the first to review it",
} as const;
