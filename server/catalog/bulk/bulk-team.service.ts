import { orgRepository } from "@server/catalog/org.repository";
import { createProducts, validateCreateRows, type RowWithNumber } from "@server/catalog/bulk/bulk-product.service";
import { BULK_TEAM_ACTION, type BulkProductCreateRow, type RowError } from "@server/catalog/bulk/bulk.types";
import { TEAM_BULK_COPY } from "@server/catalog/bulk/sheet-copy";
import { recordAdminAction } from "@server/shared/audit/audit.service";
import { ConflictError, NotFoundError } from "@server/shared/domain-error";

export type TeamBulkResult = { ok: false; errors: RowError[] } | { ok: true; created: number; updated: number };

/**
 * The Bhendi Bazaar team's bulk upload for a shop (own-store/bulk-sheet D11; own-store Q17, Q18).
 * The shop's own pipeline with the admin as the editor, then one audit entry for the whole upload.
 */
export class BulkTeamService {
  /** The path's shop, or 404: every admin bulk route is scoped to it. */
  async shop(orgId: string) {
    const shop = await orgRepository.findStanding(orgId);
    if (!shop) throw new NotFoundError("Shop not found");
    return shop;
  }

  async create(
    orgId: string,
    rows: RowWithNumber<BulkProductCreateRow>[],
    input: { reason: string; fileName?: string },
    adminId: string,
  ): Promise<TeamBulkResult> {
    const shop = await this.shop(orgId);
    if (!shop.isActive || shop.isBlocked) throw new ConflictError(TEAM_BULK_COPY.deactivated(shop.name));
    // All or nothing, as for the shop (Q19): nothing is written while any row has a problem.
    const errors = await validateCreateRows(orgId, rows);
    if (errors.length) return { ok: false, errors };
    // After commit and before the sale prices, so a failed markdown write still leaves the entry
    // (Q17); never failing the import (ADR-0021): one entry, not one per row.
    const { created, updated } = await createProducts(orgId, rows, { userId: adminId, team: true }, (done) =>
      recordAdminAction({
        adminId,
        action: BULK_TEAM_ACTION.UPLOADED,
        resource: "Org",
        resourceId: orgId,
        metadata: { orgId, reason: input.reason, fileName: input.fileName ?? null, ...done },
      }),
    );
    return { ok: true, created, updated };
  }
}

export const bulkTeamService = new BulkTeamService();
