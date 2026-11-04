import { prisma } from "@server/shared/prisma";
import { recordAdminActions } from "@server/shared/audit/audit.service";
import type { CreateLogInput } from "@server/shared/audit/audit.types";
import { lockedAmong } from "@server/bidding/bidding-lock";
import { adminProductsRepository, type BulkScope } from "@server/catalog/product.repository";
import { stockService } from "@server/catalog/stock.service";
import { PRODUCT_TEAM_ACTION } from "@server/catalog/product-team";
import {
  BULK_ACTION,
  BULK_ACTOR,
  BULK_SKIP_REASON,
  MAX_PRICE_PAISE,
  PRODUCT_AUDIT_ACTION,
  type BulkActionResultDTO,
  type BulkActor,
  type BulkPriceChange,
  type BulkSkippedDTO,
  type BulkStockConflictDTO,
  type BulkStockRow,
} from "@server/catalog/product-bulk.types";

/**
 * Acting on many selected products at once (design-system decisions Q29). Each action is one
 * guarded statement over the whole selection inside one transaction, never a loop of single-row
 * writes; the statement reports every row's verdict, so nothing is read twice to explain a skip.
 * A shop is held to its own products by `orgId` in every statement; an id it does not own reads
 * as not found.
 */

const scopeOf = (actor: BulkActor): BulkScope =>
  actor.kind === BULK_ACTOR.ORG ? { orgId: actor.orgId, excludeArchived: false } : { orgId: null, excludeArchived: true };

const editorOf = (actor: BulkActor) => ({ userId: actor.userId, team: actor.kind === BULK_ACTOR.TEAM });

/** Selected ids the statement never saw: absent, or another shop's. Input order kept. */
const notFound = (ids: readonly string[], seen: ReadonlySet<string>): BulkSkippedDTO[] =>
  ids.filter((id) => !seen.has(id)).map((productId) => ({ productId, reason: BULK_SKIP_REASON.NOT_FOUND }));

/** One entry per product changed; a team change is written as the shop's history reads it (product-form D13). */
function auditEntries(actor: BulkActor, action: string, rows: ReadonlyArray<{ id: string; orgId: string; metadata: Record<string, unknown> }>): CreateLogInput[] {
  return rows.map((row) => ({
    adminId: actor.userId,
    action,
    resource: "Product",
    resourceId: row.id,
    metadata: { orgId: row.orgId, ...(actor.kind === BULK_ACTOR.TEAM ? { reason: actor.reason } : {}), ...row.metadata },
  }));
}

function priceSkip(row: { archived: boolean; before: number; after: number }, scope: BulkScope) {
  if (scope.excludeArchived && row.archived) return BULK_SKIP_REASON.ARCHIVED;
  if (row.after < 1) return BULK_SKIP_REASON.PRICE_TOO_LOW;
  if (row.after > MAX_PRICE_PAISE) return BULK_SKIP_REASON.PRICE_TOO_HIGH;
  return BULK_SKIP_REASON.UNCHANGED;
}

export const productBulkService = {
  /**
   * A new price for each selected product, worked out on the server from its stored price
   * (Invariant 1). A percentage rounds to the nearest paisa, half away from zero; a result below
   * one paisa or above the form's ceiling leaves that product as it was.
   *
   * A running sale price (an offer) is not re-judged: the engine already clamps a markdown that no
   * longer marks the price down, as a form save that leaves the sale price alone does.
   */
  async setPrice(actor: BulkActor, productIds: readonly string[], change: BulkPriceChange): Promise<BulkActionResultDTO> {
    const scope = scopeOf(actor);
    const now = new Date();
    const rows = (await prisma.$transaction((tx) => adminProductsRepository.bulkSetPriceIn(tx, scope, productIds, change, editorOf(actor), now))).map(
      (row) => ({ ...row, after: Number(row.after) }),
    );
    const changed = rows.filter((row) => row.updated);
    const skipped = [
      ...rows.filter((row) => !row.updated).map((row) => ({ productId: row.id, reason: priceSkip(row, scope) })),
      ...notFound(productIds, new Set(rows.map((row) => row.id))),
    ];
    const action = actor.kind === BULK_ACTOR.TEAM ? PRODUCT_TEAM_ACTION.UPDATED : PRODUCT_AUDIT_ACTION.PRICE_SET;
    await recordAdminActions(
      auditEntries(actor, action, changed.map((row) => ({ id: row.id, orgId: row.orgId, metadata: { changes: [{ field: "price", before: row.before, after: row.after }] } }))),
    );
    return { action: BULK_ACTION.PRICE, updated: changed.length, skipped, conflicts: [] };
  },

  /**
   * Set counted stock at a location for each selected row, against the count the editor saw
   * (Invariant 6). A row that moved since is reported as a conflict with what it holds now; the
   * rest are written. Marketplaces hear each changed product's new count (inventory-sync D2).
   */
  async setStock(actor: BulkActor, rows: readonly BulkStockRow[]): Promise<BulkActionResultDTO> {
    const scope = scopeOf(actor);
    const verdicts = await prisma.$transaction(async (tx) => {
      const result = await stockService.setCountedMany(tx, scope.orgId, scope.excludeArchived, rows);
      await stockService.changedMany(result.filter((row) => row.written).map((row) => row.productId), tx);
      return result;
    });
    const key = (row: { productId: string; orgAddressId: string }) => `${row.productId}:${row.orgAddressId}`;
    const byKey = new Map(verdicts.map((row) => [key(row), row]));
    // One read for the whole selection: which shop owns each product, for the trail and to tell a
    // location outside the shop from a product outside the caller's reach.
    const owners = new Map(
      (await adminProductsRepository.ownersOf([...new Set(rows.map((row) => row.productId))], scope.orgId)).map((owner) => [owner.id, owner.orgId]),
    );
    const skipped: BulkSkippedDTO[] = [];
    const conflicts: BulkStockConflictDTO[] = [];
    const written: BulkStockRow[] = [];
    for (const row of rows) {
      const verdict = byKey.get(key(row));
      const current = verdict?.current ?? 0;
      if (!verdict) {
        skipped.push({ productId: row.productId, reason: owners.has(row.productId) ? BULK_SKIP_REASON.LOCATION_NOT_FOUND : BULK_SKIP_REASON.NOT_FOUND });
      } else if (verdict.written) written.push(row);
      else if (scope.excludeArchived && verdict.archived) skipped.push({ productId: row.productId, reason: BULK_SKIP_REASON.ARCHIVED });
      else if (row.quantity === row.seenQuantity && current === row.seenQuantity) skipped.push({ productId: row.productId, reason: BULK_SKIP_REASON.UNCHANGED });
      else conflicts.push({ productId: row.productId, orgAddressId: row.orgAddressId, seenQuantity: row.seenQuantity, currentQuantity: current });
    }
    const action = actor.kind === BULK_ACTOR.TEAM ? PRODUCT_TEAM_ACTION.UPDATED : PRODUCT_AUDIT_ACTION.STOCK_SET;
    await recordAdminActions(
      auditEntries(
        actor,
        action,
        written.map((row) => ({
          id: row.productId,
          orgId: owners.get(row.productId) ?? "",
          metadata: { changes: [{ field: "stock", at: row.orgAddressId, before: row.seenQuantity, after: row.quantity }] },
        })),
      ),
    );
    return { action: BULK_ACTION.STOCK, updated: written.length, skipped, conflicts };
  },

  /**
   * Archive each selected product (ADR-0029) under the rules a single archive keeps: behind the
   * stock locks, refused for one a live bidding event holds, idempotent for one already archived,
   * and its marketplaces told it sells nowhere now (inventory-sync Q6).
   */
  async archive(actor: BulkActor, productIds: readonly string[]): Promise<BulkActionResultDTO> {
    const scope = scopeOf(actor);
    const now = new Date();
    const { rows, held } = await prisma.$transaction(async (tx) => {
      await stockService.lockAllOf(productIds, scope.orgId, tx);
      const held = await lockedAmong([...productIds], now, tx);
      const rows = await adminProductsRepository.bulkArchiveIn(tx, scope, productIds, [...held], now);
      await stockService.markSoldOut(rows.filter((row) => row.updated).map((row) => row.id), tx);
      return { rows, held };
    });
    const changed = rows.filter((row) => row.updated);
    const skipped = [
      ...rows
        .filter((row) => !row.updated)
        .map((row) => ({ productId: row.id, reason: row.wasArchived ? BULK_SKIP_REASON.ALREADY_ARCHIVED : held.has(row.id) ? BULK_SKIP_REASON.BIDDING_LIVE : BULK_SKIP_REASON.UNCHANGED })),
      ...notFound(productIds, new Set(rows.map((row) => row.id))),
    ];
    await recordAdminActions(auditEntries(actor, PRODUCT_AUDIT_ACTION.ARCHIVED, changed.map((row) => ({ id: row.id, orgId: row.orgId, metadata: { name: row.name } }))));
    return { action: BULK_ACTION.ARCHIVE, updated: changed.length, skipped, conflicts: [] };
  },

  /** The shop each selected product belongs to, within the caller's reach: what a bulk send groups by. */
  async ownersOf(productIds: readonly string[], orgId: string | null) {
    return await adminProductsRepository.ownersOf(productIds, orgId);
  },
};
