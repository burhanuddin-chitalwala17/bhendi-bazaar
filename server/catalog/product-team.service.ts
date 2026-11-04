import { productsService } from "@server/catalog/admin.product.service";
import { orgRepository } from "@server/catalog/org.repository";
import type { ProductFormInput } from "@server/catalog/admin.product.types";
import {
  ARCHIVED_REFUSAL,
  PRODUCT_TEAM_ACTION,
  answersOf,
  teamChanges,
  toTeamEdits,
  type ProductTeamEditDto,
  type TeamSnapshot,
} from "@server/catalog/product-team";
import { adminProductsRepository } from "@server/catalog/product.repository";
import { parseStoredFacts, parseStoredMeasurements } from "@server/listing/listing-facts";
import { promotionService } from "@server/promotions/promotion.service";
import { listResourceActions, recordAdminAction } from "@server/shared/audit/audit.service";
import { ConflictError, NotFoundError } from "@server/shared/domain-error";
import { productBulkService } from "@server/catalog/product-bulk.service";
import { BULK_ACTION, BULK_ACTOR, type BulkActionResultDTO, type BulkPriceChange, type BulkStockRow } from "@server/catalog/product-bulk.types";

type TeamInput = Omit<ProductFormInput, "orgId" | "reason"> & { reason: string };
type ProductRecord = Awaited<ReturnType<typeof productsService.getProductById>>;

/**
 * The Bhendi Bazaar team adding or fixing a shop's product (product-form D11, D12; own-store Q17).
 * The same catalog commands the shop's form calls, with the admin as the editor (ADR-0055), and
 * then one audit entry with the reason and each field's before and after. The org is always the
 * product's or the path's, never the body's.
 */
export class ProductTeamService {
  async create(orgId: string, input: TeamInput, adminId: string) {
    if (!(await orgRepository.findSummary(orgId))) throw new NotFoundError("Shop not found");
    const { reason, ...data } = input;
    const product = await productsService.createProduct({ ...data, orgId }, { userId: adminId, team: true });
    await this.record(adminId, PRODUCT_TEAM_ACTION.CREATED, product.id, orgId, reason, null);
    return product;
  }

  async update(id: string, input: TeamInput & { seenVersion: number }, adminId: string) {
    const current = await productsService.getProductById({ id });
    // Checked before the save as the shop's own form would see it: archived sells nowhere (ADR-0029).
    if (current.archivedAt) throw new ConflictError(ARCHIVED_REFUSAL);
    const before = await this.snapshot(current);
    const { reason, ...data } = input;
    const orgId = current.org.id;
    const product = await productsService.updateProduct(id, { ...data, orgId }, { userId: adminId, team: true });
    await this.record(adminId, PRODUCT_TEAM_ACTION.UPDATED, id, orgId, reason, before);
    return product;
  }

  /**
   * The team's bulk price, stock or archive on selected shop products (design-system Q29): the
   * shop's own bulk commands with the admin as editor, each product's trail entry carrying the reason.
   */
  async bulkEdit(
    adminId: string,
    reason: string,
    input:
      | { action: typeof BULK_ACTION.PRICE; productIds: string[]; change: BulkPriceChange }
      | { action: typeof BULK_ACTION.STOCK; rows: BulkStockRow[] }
      | { action: typeof BULK_ACTION.ARCHIVE; productIds: string[] },
  ): Promise<BulkActionResultDTO> {
    const actor = { kind: BULK_ACTOR.TEAM, userId: adminId, reason } as const;
    if (input.action === BULK_ACTION.PRICE) return await productBulkService.setPrice(actor, input.productIds, input.change);
    if (input.action === BULK_ACTION.STOCK) return await productBulkService.setStock(actor, input.rows);
    return await productBulkService.archive(actor, input.productIds);
  }

  /** Back on sale for its shop; the archive trail records it as every restore is (ADR-0029). */
  async restore(id: string, adminId: string) {
    const current = await productsService.getProductById({ id });
    return await productsService.restoreProduct(id, { orgId: current.org.id, userId: adminId });
  }

  /** The shop's history of the team's saves on one of its products, newest first (D13). */
  async history(productId: string, orgId: string): Promise<ProductTeamEditDto[]> {
    const entries = await listResourceActions("Product", productId, Object.values(PRODUCT_TEAM_ACTION));
    return toTeamEdits(entries, orgId);
  }

  /** Home's line (Q23): how many of the shop's products carry the team's mark, and which when one. */
  async teamEditedSummary(orgId: string) {
    return await adminProductsRepository.teamEditedSummary(orgId);
  }

  /** After the save has committed, and never failing it (ADR-0021): the trail reports, it does not decide. */
  private async record(
    adminId: string,
    action: (typeof PRODUCT_TEAM_ACTION)[keyof typeof PRODUCT_TEAM_ACTION],
    productId: string,
    orgId: string,
    reason: string,
    before: TeamSnapshot | null,
  ) {
    try {
      const after = await this.snapshot(await productsService.getProductById({ id: productId }));
      const changes = teamChanges(before, after);
      await recordAdminAction({ adminId, action, resource: "Product", resourceId: productId, metadata: { orgId, reason, changes } });
    } catch (error) {
      console.error("[product-team] audit entry not recorded", { productId, action, error });
    }
  }

  private async snapshot(product: ProductRecord): Promise<TeamSnapshot> {
    return {
      price: product.price,
      salePrice: await promotionService.productMarkdownPaise(product.id),
      stock: Object.fromEntries(product.stockLocations.map((row) => [`${row.orgAddress.name} (${row.orgAddressId})`, row.quantity])),
      name: product.name,
      description: product.description,
      category: product.category.name,
      sku: product.sku,
      weight: product.weight,
      lowStockThreshold: product.lowStockThreshold,
      tags: product.tags,
      flags: product.flags,
      kind: product.kind,
      familyId: product.familyId,
      brandId: product.brandId,
      facts: answersOf(parseStoredFacts(product.facts)),
      measurements: answersOf(parseStoredMeasurements(product.measurements)),
      media: product.media.map((item) => item.ref),
    };
  }
}

export const productTeamService = new ProductTeamService();
