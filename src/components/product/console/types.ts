import { ProductFlag, Pagination } from "@/types/shared";
import type { OrgSummary } from "@/domain/org";

// The one ProductFormInput: declared server-side, re-exported here so the two sides
// cannot drift again (CONTRACTS.md — weight was collected and never written).
export type { ProductFormInput } from "@server/catalog/admin.product.types";
import type { ProductMediaDto } from "@server/catalog/media";
import type { ProductShelf } from "@server/catalog/product.visibility";
import type { Channel } from "@server/shared/channels";
import type { NotReadyReason } from "@server/listing/channel-readiness.service";

export interface ProductFilters {
  /** Which shelf to list. Defaults to available; archived products are asked for. */
  shelf?: ProductShelf;
  search?: string; // Search by name, SKU, tags
  categoryId?: string;
  orgId?: string;
  flags?: ProductFlag[]; // Filter by any flags
  lowStock?: boolean; // Products below lowStockThreshold
  outOfStock?: boolean; // Stock = 0
  /** Only products at least one person has saved. Resolved to ids in the DAL. */
  wishlistedOnly?: boolean;
  /** Only products this channel would refuse as they stand (design-system Q35). Resolved to ids in the DAL. */
  notReadyOn?: Channel;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
  sortBy?: "name" | "createdAt" | "price" | "stock";
  sortOrder?: "asc" | "desc";
}

export interface ProductListResult {
  products: ProductForTable[];
  pagination: Pagination;
}

export interface ProductForTable {
  id: string;
  name: string;
  flags: ProductFlag[];
  sku?: string;
  price: number;
  salePrice?: number;
  currency: string;
  stock: number;
  /** Each location's count as read; a bulk stock edit sends it back as `seenQuantity` (Invariant 6). */
  stockByLocation: Array<{ orgAddressId: string; quantity: number }>;
  lowStockThreshold: number;
  thumbnail: string;
  /** How many users have this saved. Demand, read-only — never sorted or filtered on. */
  wishlistCount: number;
  /** Set when the org archived the product (ADR-0029); null while it is available. */
  archivedAt: Date | null;
  /** Set by a Bhendi Bazaar team save until the shop next saves (product-form D13). */
  teamEditedAt: Date | null;
  createdAt: Date;
  category: { id: string; name: string };
  org: { id: string; name: string; code: string };
  /** What keeps it off the channel being filtered on (Q35); absent when the list is not filtered by one. */
  notReady?: NotReadyReason[];
}

export interface ProductDetails {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  salePrice?: number;
  currency: string;
  category: { id: string; name: string };
  tags: string[];
  flags: ProductFlag[];
  sku?: string;
  /** Paise; null until the shop or a marketplace fill sets it. */
  mrpPaise?: number | null;
  barcode?: string | null;
  keyFeatures?: string[];
  stock: number;
  lowStockThreshold: number;
  weight: number;
  media: ProductMediaDto[];
  thumbnail: string;
  org: OrgSummary;
  /**
   * The listing vocabulary as stored, each answer with the level that supplied it — the form
   * says "from your brand Noor" beside anything filled in rather than typed (inherited-facts R3).
   */
  productType?: string | null;
  kind?: string | null;
  familyId?: string | null;
  facts?: Record<string, { value: string | number | boolean; origin: string; unlisted?: boolean; source?: { channel: string; value: string; readAt: string; chosen?: boolean } }>;
  measurements?: Record<string, { value: number; origin: string; source?: { channel: string; value: string; readAt: string; chosen?: boolean } }>;
  /** Per-location breakdown (stock-locations R9/A7); `stock` stays the total. */
  stockLocations: Array<{
    orgAddressId: string;
    locationName: string;
    quantity: number;
  }>;
  createdAt: Date;
  /** What an edit sends back as `seenVersion`; a save from an older one is refused (product-form D6). */
  version: number;
  /** Who saved last and when (D7); the name only, never an id. */
  lastEditedAt: Date | null;
  lastEditedBy: string | null;
  /** Set while the Bhendi Bazaar team's save is the latest (D7, Q14). */
  teamEditedAt: Date | null;
  /** Set while archived; the team's edit page offers "Restore" instead of the form (product-form D12). */
  archivedAt?: Date | null;
}

export interface ProductStats {
  /** Available. Archived products are counted separately, never folded in here. */
  totalProducts: number;
  /** How many families those sellable products belong to — zero until one is made. */
  familyCount: number;
  /** Archived but intact (ADR-0029) — excluded from every other figure here. */
  archivedProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  featuredProducts: number;
  totalInventoryValue: number;
}
