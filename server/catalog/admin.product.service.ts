// server/services/admin/productService.ts

import { adminProductsRepository } from "@server/catalog/admin.product.repository";
import { resolveShotList, unknownSlots } from "@server/catalog/shot-list";
import { fillListing } from "@server/listing/listing-fill.service";
import { holdsKind, resolveProductType } from "@server/listing/product-type";
import { productTypeRepository } from "@server/listing/product-type.repository";
import { categoryRepository } from "@server/catalog/category.repository";
import {
  ProductCopyOption,
  ProductCopySource,
  ProductFilters,
  ProductFormInput,
} from "@server/catalog/admin.product.types";
import { ProductFlag } from "@server/catalog/product.flags";
import { ConflictError, NotFoundError } from "@server/shared/domain-error";
import { rupeesToPaise } from "@server/shared/money";
import { orgAddressRepository } from "@server/catalog/org.address.repository";
import { DomainError } from "@server/shared/domain-error";
import { promotionService } from "@server/promotions/promotion.service";
import { lockedAmong } from "@server/bidding/bidding-lock";

/**
 * Pure, exported for tests: every submitted stock row must name a location the
 * product's own org owns — otherwise a member of one org could park stock at (and
 * attribute parcels to) another org's address by editing the payload.
 */
export function assertLocationsBelongToOrg(
  rows: Array<{ orgAddressId: string }>,
  orgLocationIds: string[]
): void {
  const owned = new Set(orgLocationIds);
  if (rows.some((row) => !owned.has(row.orgAddressId))) {
    throw new DomainError("One of the chosen pickup locations does not belong to this organisation", {
      field: "stockLocations",
    });
  }
}

// `deriveThumbnail` was here until product-video. It made the thumbnail the first
// gallery image, which stopped an edited gallery leaving a stale card image — but it
// also meant the org could not choose. The cover is now an explicit flag on a media
// row and gallery order means nothing outside the gallery (R16), so the derivation has
// no job left: the repository reads the cache off the flagged row inside the same
// transaction (D4a/D4b).

/** Who is acting, and for which org. Both come from `resolveOrgScope`, never a body. */
export type ProductActor = { orgId: string; userId: string };

/** What blocks a product's deletion, in the order the owning org would find useful. */
export type DeleteBlockers = {
  orderItems: number;
  promotionTargets: number;
  biddingEvents: number;
};

const BLOCKER_NOUNS: Array<[keyof DeleteBlockers, string, string]> = [
  ["orderItems", "order", "orders"],
  ["promotionTargets", "promotion", "promotions"],
  ["biddingEvents", "bidding event", "bidding events"],
];

/**
 * Pure, exported for tests: the sentence a refused delete is reported with, or null
 * when nothing blocks it.
 *
 * It names the counts because "this has been ordered" leaves the org guessing
 * whether one abandoned basket or a year of trade is in the way.
 */
export function describeDeleteBlockers(counts: DeleteBlockers): string | null {
  const parts = BLOCKER_NOUNS.filter(([key]) => counts[key] > 0).map(
    ([key, one, many]) => `${counts[key]} ${counts[key] === 1 ? one : many}`
  );
  if (!parts.length) return null;
  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  const total = BLOCKER_NOUNS.reduce((sum, [key]) => sum + counts[key], 0);
  const [verb, record] = total === 1 ? ["refers", "that record"] : ["refer", "those records"];
  return `This product cannot be deleted — ${list} still ${verb} to it, and deleting it would break ${record}. Archive it instead to take it off the storefront.`;
}

export class ProductsService {
  async getProducts(filters: ProductFilters) {
    return await adminProductsRepository.getProducts(filters);
  }
  
  async getStats(orgId: string | null) {
    return await adminProductsRepository.getStats(orgId);
  }

  /**
   * Delete, and only for a product no record depends on (ADR-0029 decision 2).
   *
   * Its media, cart lines, wishlist entries and stock rows cascade with it, which is
   * right for a listing created by mistake and right for nothing else. An order line,
   * promotion target or bidding event makes the product permanent, and the refusal
   * names what holds it and points at Archive.
   *
   * It used to archive in that case instead. That degrade existed because Archive had
   * no control of its own, so Delete was the only button in the row; now that Archive
   * is its own action the degrade only made one button do two things, and the label
   * was wrong for whichever one it did.
   *
   * The count decides the message; the foreign keys remain the enforcement, so an
   * order placed between the count and the delete still loses to the constraint and
   * surfaces through the `restricted` branch of `toErrorResponse`.
   */
  async deleteProduct(id: string): Promise<void> {
    const blockers = await adminProductsRepository.countDeleteBlockers(id);
    if (!blockers) {
      throw new NotFoundError("Product not found");
    }

    const refusal = describeDeleteBlockers(blockers);
    if (refusal) {
      throw new ConflictError(refusal);
    }

    await adminProductsRepository.deleteProduct(id);
  }

  /**
   * Archive a product, reversibly (product-archive R1).
   *
   * Available for any product, including one never sold — an org curating its shelf
   * should not have to sell something first to be allowed to withdraw it.
   */
  async archiveProduct(id: string, scope: ProductActor) {
    const product = await this.ownedByOrg(id, scope.orgId);
    // Idempotent: archiving something already archived is the state the caller
    // asked for, not a conflict.
    if (product.archivedAt) return product;

    // A live event is a standing commitment to the people bidding on it (R11).
    // Cancelling it is the org's own separate act, deliberately not chained to this.
    //
    // Checked inside the write, behind the stock lock, because opening an event takes
    // that same lock: asked beforehand, an event could open in the gap between the
    // question and the answer and the product would be archived under live bids.
    return await adminProductsRepository.setArchived(
      id,
      new Date(),
      scope.userId,
      async (tx) => {
        const locked = await lockedAmong([id], new Date(), tx);
        if (locked.has(id)) {
          throw new ConflictError(
            "This product has a live bidding event. Cancel the event, or let it finish, before archiving it."
          );
        }
      }
    );
  }

  /** Restore it, at the same URL it had (product-archive R6). */
  async restoreProduct(id: string, scope: ProductActor) {
    const product = await this.ownedByOrg(id, scope.orgId);
    if (!product.archivedAt) return product;
    return await adminProductsRepository.setArchived(id, null, scope.userId);
  }

  /**
   * The product, having established it is this org's to act on.
   *
   * Reported as not-found rather than forbidden: whether another org owns that id is
   * not this caller's business. Reads through the org-facing query deliberately, which
   * sees archived products — restoring one requires finding it first.
   */
  private async ownedByOrg(id: string, orgId: string) {
    const product = await adminProductsRepository.getProductById(id);
    if (!product || product.org.id !== orgId) {
      throw new NotFoundError("Product not found");
    }
    return product;
  }

  async createProduct(data: ProductFormInput) {
    await this.checkLocations(data);
    await this.checkSlots(data);
    await this.checkKind(data);
    const priced = { ...this.moneyToPaise(data), ...(await this.fill(data)) };
    const product = await adminProductsRepository.createProduct(priced);
    await this.syncMarkdown(product.id, priced);
    return product;
  }

  async getProductById({ id }: { id: string }) {
    const product = await adminProductsRepository.getProductById(id);
    if (!product) {
      throw new NotFoundError("Product not found");
    }
    return product;
  }

  /**
   * The fields a new product may take from one of the org's own. Scoped through
   * `ownedByOrg`, so a `copyFrom` naming another org's product is a 404, not a leak.
   * Archived products are copyable: the org can still see them on its Archived shelf.
   */
  async getCopySource(id: string, orgId: string): Promise<ProductCopySource> {
    const product = await this.ownedByOrg(id, orgId);
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      categoryId: product.category.id,
      tags: product.tags,
      flags: product.flags as ProductFlag[],
    };
  }

  async listCategoriesSoldBy(orgId: string): Promise<Array<{ id: string; name: string }>> {
    return adminProductsRepository.listCategoriesSoldBy(orgId);
  }

  async listCopyOptions(orgId: string): Promise<ProductCopyOption[]> {
    return adminProductsRepository.listCopyOptions(orgId);
  }

  async updateProduct(id: string, data: ProductFormInput) {
    await this.checkLocations(data);
    await this.checkSlots(data);
    await this.checkKind(data);
    const priced = { ...this.moneyToPaise(data), ...(await this.fill(data)) };
    const product = await adminProductsRepository.updateProduct(id, priced);
    if (!product) {
      throw new NotFoundError("Product not found");
    }
    await this.syncMarkdown(id, priced);
    return product;
  }

  /**
   * The listing vocabulary's answers, worked out on save
   * ([inherited-facts](../../docs/specs/listing-vocabulary/inherited-facts/) D2). Nothing here
   * refuses a save: a product with facts unanswered still sells on this storefront and is told
   * what is missing instead (listing-vocabulary spec R5).
   */
  private async fill(data: ProductFormInput) {
    const filled = await fillListing({
      categoryId: data.categoryId,
      orgId: data.orgId,
      familyId: data.familyId ?? null,
      brandId: data.brandId ?? null,
      facts: data.facts as never,
      measurements: data.measurements as never,
    });
    return {
      productType: filled.productType,
      facts: filled.facts,
      measurements: filled.measurements,
    };
  }

  /** A kind must be one its type holds — otherwise no channel can map it (product-types D3). */
  private async checkKind(data: ProductFormInput): Promise<void> {
    if (!data.kind) return;
    const key = resolveProductType(data.categoryId, await categoryRepository.list());
    const type = await productTypeRepository.byKey(key);
    if (!holdsKind(type, data.kind)) {
      throw new DomainError(
        type
          ? `"${data.kind}" is not a kind of ${type.label}`
          : "This category has no product type, so it holds no kinds",
        { status: 400, field: "kind" },
      );
    }
  }

  /** A gallery slot must be one the product's category asks for (media-library R4, D4). */
  private async checkSlots(data: ProductFormInput): Promise<void> {
    const used = data.media.map((item) => item.slot);
    if (!used.some(Boolean)) return;
    const list = resolveShotList(data.categoryId, await categoryRepository.list());
    const unknown = unknownSlots(used, list);
    if (unknown.length) {
      throw new DomainError(`This category has no "${unknown[0]}" slot`, { status: 400, field: "media" });
    }
  }

  private async checkLocations(data: ProductFormInput): Promise<void> {
    const locations = await orgAddressRepository.listByOrg(data.orgId);
    assertLocationsBelongToOrg(data.stockLocations, locations.map((l) => l.id));
  }

  /**
   * A sale price on the product form is an offer, not a column (promotions D9).
   *
   * An organisation still types a sale price beside the price, which is the common action
   * and the one worth keeping cheap; what changed is that it lands as an org-funded,
   * product-targeted offer at a fixed selling price. That is what lets it be weighed
   * against a platform campaign, and charged to whoever actually paid for it.
   *
   * Clearing the field deactivates the offer rather than deleting it, since it may
   * already be named by an order's discount record.
   */
  // Takes only what it reads, so it serves both the submitted shape and the persisted one.
  private async syncMarkdown(
    productId: string,
    data: Pick<ProductFormInput, "salePrice" | "price" | "name" | "orgId">,
  ): Promise<void> {
    const markdown = data.salePrice;
    const valid = markdown !== undefined && markdown > 0 && markdown < data.price;
    await promotionService.setProductMarkdown({
      productId,
      productName: data.name,
      orgId: data.orgId,
      fixedPricePaise: valid ? markdown : null,
    });
  }

  /**
   * The rupees→paise seam (Invariant 3). The form collects rupees because humans type
   * rupees; everything past this line is integer paise. Conversion happens here rather
   * than in a Zod transform because the same schema validates on both client and
   * server (ADR-0013) — a transform would run twice and multiply by 100 twice.
   */
  private moneyToPaise(data: ProductFormInput): ProductFormInput {
    return {
      ...data,
      price: rupeesToPaise(data.price),
      salePrice: data.salePrice === undefined ? undefined : rupeesToPaise(data.salePrice),
    };
  }
}

export const productsService = new ProductsService();