// server/services/admin/productService.ts

import { adminProductsRepository } from "@server/catalog/admin.product.repository";
import { ProductFilters, ProductFormInput } from "@server/catalog/admin.product.types";
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
  return `This product cannot be deleted — ${list} still ${verb} to it, and deleting it would break ${record}.`;
}

export class ProductsService {
  async getProducts(filters: ProductFilters) {
    return await adminProductsRepository.getProducts(filters);
  }
  
  async getStats(orgId: string | null) {
    return await adminProductsRepository.getStats(orgId);
  }

  /**
   * One control, two outcomes (ADR-0029 decision 2, product-archive R8).
   *
   * A product no record depends on is deleted outright — its media, cart lines,
   * wishlist entries and stock rows cascade with it, which is right for a listing
   * created by mistake. Anything an order line, promotion target or bidding event
   * refers to is archived instead, because deleting it would falsify those records.
   *
   * The org is told which happened rather than being asked to know why. The blocker
   * count decides; the foreign keys remain the enforcement, so an order placed between
   * the count and the delete still loses to the constraint and surfaces through the
   * `restricted` branch of `toErrorResponse`.
   */
  async deleteProduct(
    id: string,
    scope: ProductActor
  ): Promise<{ outcome: "deleted" | "archived" }> {
    const blockers = await adminProductsRepository.countDeleteBlockers(id);
    if (!blockers) {
      throw new NotFoundError("Product not found");
    }

    if (describeDeleteBlockers(blockers)) {
      await this.archiveProduct(id, scope);
      return { outcome: "archived" };
    }

    await adminProductsRepository.deleteProduct(id);
    return { outcome: "deleted" };
  }

  /**
   * Take a product off sale, reversibly (product-archive R1).
   *
   * Available for any product, including one never sold — an org curating its shelf
   * should not have to sell something first to be allowed to withdraw it.
   */
  async archiveProduct(id: string, scope: ProductActor) {
    const product = await this.ownedByOrg(id, scope.orgId);
    // Idempotent: withdrawing something already withdrawn is the state the caller
    // asked for, not a conflict.
    if (product.archivedAt) return product;

    // A live event is a standing commitment to the people bidding on it (R11).
    // Cancelling it is the org's own separate act, deliberately not chained to this.
    //
    // Checked inside the write, behind the stock lock, because opening an event takes
    // that same lock: asked beforehand, an event could open in the gap between the
    // question and the answer and the product would go off sale under live bids.
    return await adminProductsRepository.setArchived(
      id,
      new Date(),
      scope.userId,
      async (tx) => {
        const locked = await lockedAmong([id], new Date(), tx);
        if (locked.has(id)) {
          throw new ConflictError(
            "This product has a live bidding event. Cancel the event, or let it finish, before taking it off sale."
          );
        }
      }
    );
  }

  /** Put it back on sale, at the same URL it had (product-archive R6). */
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
   * sees withdrawn products — restoring one requires finding it first.
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
    const priced = this.moneyToPaise(data);
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

  async updateProduct(id: string, data: ProductFormInput) {
    await this.checkLocations(data);
    const priced = this.moneyToPaise(data);
    const product = await adminProductsRepository.updateProduct(id, priced);
    if (!product) {
      throw new NotFoundError("Product not found");
    }
    await this.syncMarkdown(id, priced);
    return product;
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
  private async syncMarkdown(productId: string, data: ProductFormInput): Promise<void> {
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