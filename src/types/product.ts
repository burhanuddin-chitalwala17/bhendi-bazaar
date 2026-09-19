/**
 * Product Flag Enum
 * Used to mark products with special characteristics
 */
export enum ProductFlag {
  FEATURED = "FEATURED",
  HERO = "HERO",
  ON_OFFER = "ON_OFFER",
  NEW_ARRIVAL = "NEW_ARRIVAL",
  CLEARANCE_SALE = "CLEARANCE_SALE",
}

/**
 * Product Flag Metadata
 * UI labels and descriptions for each flag
 */
export const PRODUCT_FLAG_METADATA: Record<
  ProductFlag,
  { label: string; description: string; color?: string }
> = {
  [ProductFlag.FEATURED]: {
    label: "Featured Product",
    description: "Display this product in featured sections",
    color: "purple",
  },
  [ProductFlag.HERO]: {
    label: "Hero Product",
    description: "Display this product in hero sections on homepage",
    color: "blue",
  },
  [ProductFlag.ON_OFFER]: {
    label: "On Offer",
    description: "Mark this product as being on special offer",
    color: "orange",
  },
  [ProductFlag.NEW_ARRIVAL]: {
    label: "New Arrival",
    description: "Mark this product as a new arrival",
    color: "green",
  },
  [ProductFlag.CLEARANCE_SALE]: {
    label: "Clearance Sale",
    description: "Mark this product as part of clearance sale",
    color: "red",
  },
};

/**
 * Helper function to check if a product has a specific flag
 */
export function hasFlag(flags: ProductFlag[], flag: ProductFlag): boolean {
  return flags.includes(flag);
}

/**
 * Helper function to toggle a flag
 */
export function toggleFlag(flags: ProductFlag[], flag: ProductFlag): ProductFlag[] {
  return hasFlag(flags, flag)
    ? flags.filter((f) => f !== flag)
    : [...flags, flag];
}


/**
 * Narrow the database's `String[]` to the closed set.
 *
 * `Product.flags` is an untyped string array in Postgres, so a row can hold anything an
 * older deploy or a hand-edit put there. The data layer used to take the product as
 * `any`, which let those strings through as `ProductFlag[]` unchecked — a cast here
 * would restore exactly that fiction. Unknown values are dropped rather than thrown on:
 * a stale flag is not a reason to fail a product page.
 */
export function toProductFlags(values: readonly string[]): ProductFlag[] {
  const known = new Set<string>(Object.values(ProductFlag));
  return values.filter((value): value is ProductFlag => known.has(value));
}
