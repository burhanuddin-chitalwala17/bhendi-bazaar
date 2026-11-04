/** Words for product/ (ADR-0067): one object per component file, kept byte-identical to what it showed. */

/** useProductActions.ts */
export const USE_PRODUCT_ACTIONS_COPY = {
  thisItemIsUpFor: "This item is up for bidding and cannot be bought directly",
  thisItemIsOutOf: "This item is out of stock",
  addedToYourBag: "Added to your bag",
  onlyAvailable: (stock: number, inBag: number) => `Only ${stock} available, and ${inBag} already in your bag`,
  allInBag: (inBag: number) => `You already have all ${inBag} available in your bag`,
} as const;

/** useEnhancementRun.ts */
export const USE_ENHANCEMENT_RUN_COPY = {
  couldNotBeMade: "The improvement could not be made",
  takingLonger: "This is taking longer than expected. Try again in a little while.",
  couldNotCheck: "Could not check on the improvement",
  couldNotStart: "Could not start the improvement",
  couldNotKeep: "Could not keep the improvement",
  couldNotDiscard: "Could not discard the improvement",
} as const;
