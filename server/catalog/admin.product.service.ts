// server/services/admin/productService.ts

import { adminProductsRepository } from "@server/catalog/admin.product.repository";
import { ProductFilters, ProductFormInput } from "@server/catalog/admin.product.types";
import { NotFoundError } from "@server/shared/domain-error";
import { rupeesToPaise } from "@server/shared/money";
import { orgAddressRepository } from "@server/catalog/org.address.repository";
import { DomainError } from "@server/shared/domain-error";
import { promotionService } from "@server/promotions/promotion.service";

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

export class ProductsService {
  async getProducts(filters: ProductFilters) {
    return await adminProductsRepository.getProducts(filters);
  }
  
  async getStats(orgId: string | null) {
    return await adminProductsRepository.getStats(orgId);
  }

  async deleteProduct(id: string) {
    return await adminProductsRepository.deleteProduct(id);
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