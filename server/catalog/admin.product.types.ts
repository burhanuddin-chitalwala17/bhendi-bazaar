import { ProductFlag } from "@server/catalog/product.flags";
import type { ProductShelf } from "@server/catalog/product.visibility";
import type { ProductMediaInput } from "@server/catalog/media";

export interface ProductFilters {
  /**
   * Which shelf the org is asking about (ADR-0029). Defaults to `available`: an
   * archived product is absent from the working list unless asked for, which is
   * what makes withdrawal feel like removal without being one.
   */
  shelf?: ProductShelf;
  search?: string; // Search by name, SKU, tags
  categoryId?: string;
  orgId?: string;
  flags?: ProductFlag[]; // Filter by any flags
  lowStock?: boolean; // Products below lowStockThreshold
  outOfStock?: boolean; // Stock = 0
  /**
   * Narrow to exactly these products. Always resolved server-side by the caller, never
   * client input, so it cannot widen a query past the org scope. Catalog does not ask
   * where the list came from — that is what keeps the other domain's table out of here.
   */
  productIds?: string[];
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
  sortBy?: "name" | "createdAt" | "price" | "stock";
  sortOrder?: "asc" | "desc";
}

export interface ProductFormInput {
  name: string;
  description?: string;
  price: number;
  salePrice?: number;
  currency?: string;
  orgId: string;
  categoryId: string;
  tags?: string[];
  flags?: ProductFlag[];
  /**
   * The gallery, in gallery order. Exactly one item carries `isThumbnail` (R15).
   * `thumbnail` is absent deliberately: it is derived from that item and is server-owned,
   * so accepting it would be accepting a value we then overwrite (Invariant 4).
   */
  media: ProductMediaInput[];
  /**
   * Stock per pickup location (stock-locations R2/R3). Zero rows are dropped. `seenQuantity` is
   * what the editor loaded for an existing row — the save is refused where it no longer holds,
   * so an edit cannot undo a sale that landed meanwhile. Absent for a location with no row yet.
   */
  stockLocations: Array<{ orgAddressId: string; quantity: number; seenQuantity?: number }>;
  sku?: string;
  lowStockThreshold?: number;
  weight: number;
  /**
   * The listing vocabulary's answers. `productType` is absent deliberately — it is resolved
   * from the category tree on save and is server-owned, so accepting it would be accepting a
   * value we then overwrite (Invariant 4, categories D1b).
   */
  kind?: string | null;
  familyId?: string | null;
  brandId?: string | null;
  facts?: Record<string, string | number | boolean | null | undefined>;
  measurements?: Record<string, number | null | undefined>;
}
/**
 * What the repository writes: the form's input, plus what the server resolved on save.
 *
 * Distinct from `ProductFormInput` because the two genuinely differ. A form sends answers; the
 * repository stores answers **with the level that supplied each**, and it stores a `productType`
 * the form never sent. Forcing both through one type is how a server-owned field comes to look
 * like something a request may set (Invariant 4).
 */
export interface ProductPersistInput
  extends Omit<ProductFormInput, "facts" | "measurements"> {
  productType: string | null;
  facts: Record<string, { value: string | number | boolean; origin: string; unlisted?: boolean; source?: { channel: string; value: string; readAt: string; chosen?: boolean } }>;
  measurements: Record<string, { value: string | number | boolean; origin: string; source?: { channel: string; value: string; readAt: string; chosen?: boolean } }>;
}

/**
 * What "copy product" carries onto a new product's form — the descriptive fields only.
 * Name, price, SKU, media and stock are left behind: each identifies or values one
 * specific item, so copying them makes a duplicate rather than a sibling (copy-product R2).
 */
export type ProductCopySource = Required<
  Pick<ProductFormInput, "description" | "categoryId" | "tags" | "flags">
> & { id: string; name: string };

/** One entry in the new-product page's "Copy from" picker. */
export interface ProductCopyOption {
  id: string;
  name: string;
  sku: string | null;
}

/** Every product starts at this weight in kilograms, so a marketplace's weight replaces it (marketplace-facts Q28). */
export const DEFAULT_WEIGHT_KG = 0.5;

/** What a marketplace listing would fill on a product; catalog writes only what is still empty (marketplace-facts D7). */
export interface MarketplaceFill {
  facts: Record<string, MarketplaceEntry>;
  measurements: Record<string, MarketplaceEntry>;
  weightKg: number | null;
  mrpPaise: number | null;
  brandId: string | null;
}

export interface MarketplaceEntry {
  value: string | number | boolean;
  /** `family` for a fact a family made from listings shares with its members (family-merge D4). */
  origin: "marketplace" | "family";
  source?: { channel: string; value: string; readAt: string; chosen?: boolean };
}

export interface MarketplaceFilled {
  facts: string[];
  measurements: string[];
  weight: boolean;
  mrp: boolean;
  brand: boolean;
}
