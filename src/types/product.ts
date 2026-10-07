export enum ProductFlag {
  FEATURED = "FEATURED",
  HERO = "HERO",
  ON_OFFER = "ON_OFFER",
  NEW_ARRIVAL = "NEW_ARRIVAL",
  CLEARANCE_SALE = "CLEARANCE_SALE",
}

/** Flags the seller sets by hand. ON_OFFER and NEW_ARRIVAL are computed. */
export const MANUAL_FLAGS = [
  ProductFlag.FEATURED,
  ProductFlag.HERO,
  ProductFlag.CLEARANCE_SALE,
] as const;

const NEW_ARRIVAL_DAYS = 14;

export function isNewArrival(createdAt: Date | string): boolean {
  const created = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - NEW_ARRIVAL_DAYS);
  return created > cutoff;
}

export const PRODUCT_FLAG_METADATA: Record<
  ProductFlag,
  { label: string; description: string; color?: string; computed?: boolean }
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
    description: "Derived from active promotions",
    color: "orange",
    computed: true,
  },
  [ProductFlag.NEW_ARRIVAL]: {
    label: "New Arrival",
    description: `Derived from creation date (${NEW_ARRIVAL_DAYS} days)`,
    color: "green",
    computed: true,
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
