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
  /** Stock per pickup location (stock-locations R2/R3). Zero rows are dropped. */
  stockLocations: Array<{ orgAddressId: string; quantity: number }>;
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
  facts: Record<string, { value: string | number | boolean; origin: string; unlisted?: boolean }>;
  measurements: Record<string, { value: string | number | boolean; origin: string }>;
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
