/**
 * The one module that writes `ProductStock` (Invariant 5, ADR-0003).
 *
 * Until 2026-10-04 five modules in three domains wrote this table — the order transaction's
 * decrement, the expiry's upsert, shipping's restock, the admin edit's delete-and-recreate and
 * the location delete's sweep — which is how one row came to have several shapes and no single
 * place to read how stock moves. Every command here takes the caller's transaction, because a
 * stock movement that commits apart from the order, event or edit that caused it is the bug
 * ADR-0007 exists to prevent. Guards stay one statement with their write: read-then-write is a
 * race, not a check.
 */

import { prisma } from "@server/shared/prisma";
import type { Prisma } from "@prisma/client";
import { ConflictError } from "@server/shared/domain-error";
import { uniqueViolationFields } from "@server/shared/constraint";
import { enqueue } from "@server/shared/jobs/jobs.enqueue";
import { pushStockSpec } from "@server/shared/jobs/push-stock.job";
import { STOCK_FIELD } from "@server/catalog/product-edit";

/** `prisma`, or the `tx` of a `$transaction` — enough of either to move stock. */
export type ProductStockDb = Pick<typeof prisma, "productStock" | "$queryRawUnsafe">;
export type ShipmentStockDb = Pick<typeof prisma, "productStock" | "shipment" | "$queryRawUnsafe">;

/**
 * Every changed product's new count goes to its marketplaces (inventory-sync D2): enqueued here, in
 * the same transaction as the change, so a rolled-back sale sends nothing. A product now at nothing
 * goes first (Q19). Products not linked anywhere cost one empty job.
 */
async function stockChanged(db: ProductStockDb, productIds: Iterable<string>): Promise<void> {
  for (const productId of new Set(productIds)) {
    const total = await db.productStock.aggregate({ where: { productId }, _sum: { quantity: true } });
    await enqueue(db, pushStockSpec, { productId, soldOut: (total._sum.quantity ?? 0) === 0 });
  }
}

export interface StockLine {
  productId: string;
  orgAddressId: string;
  quantity: number;
}

/** A location row as the editor saw it: `seenQuantity` absent means the row did not exist then. */
export interface StockAdjustment {
  orgAddressId: string;
  quantity: number;
  seenQuantity?: number;
}

export const STOCK_CHANGED_MESSAGE =
  "Stock changed while you were editing. Reload to see the current quantities.";

export class StockRepository {
  /**
   * Stock on hand for one product, by location. Active locations only, matching what
   * `PRODUCT_INCLUDE` treats as sellable: an inactive location's units are held, not offered.
   * Per location rather than summed, because a caller taking a unit has to name where from.
   */
  async stockByLocation(productId: string, db: ProductStockDb = prisma) {
    return await db.productStock.findMany({
      where: { productId, orgAddress: { isActive: true }, quantity: { gt: 0 } },
      select: {
        orgAddressId: true,
        quantity: true,
        orgAddress: { select: { name: true } },
      },
      orderBy: { quantity: "desc" },
    });
  }

  /**
   * Where these products' units are, with the location's org and geography — what the order
   * transaction allocates across and then decrements (stock-locations D6). Read inside the
   * caller's transaction so the rows allocated are the rows reserved.
   */
  async onHandByLocation(productIds: string[], db: ProductStockDb = prisma) {
    return await db.productStock.findMany({
      where: {
        productId: { in: productIds },
        quantity: { gt: 0 },
        orgAddress: { isActive: true },
      },
      select: {
        productId: true,
        orgAddressId: true,
        quantity: true,
        orgAddress: {
          select: {
            orgId: true,
            address: { select: { pincode: true, city: true, state: true } },
          },
        },
      },
    });
  }

  /**
   * Reserve each line, conditionally (Invariant 6, ADR-0007): the availability check IS the
   * where clause of the write. Lines must arrive in `reservationPlan` order so concurrent orders
   * lock rows in one sequence. Returns the first product that could not be reserved, or null;
   * the caller decides what to tell the buyer and whether to retry.
   */
  async reserve(lines: readonly StockLine[], tx: ProductStockDb = prisma): Promise<string | null> {
    for (const { productId, orgAddressId, quantity } of lines) {
      const reserved = await tx.productStock.updateMany({
        where: { productId, orgAddressId, quantity: { gte: quantity } },
        data: { quantity: { decrement: quantity } },
      });
      if (reserved.count === 0) return productId;
    }
    await stockChanged(tx, lines.map((l) => l.productId));
    return null;
  }

  /**
   * Put an abandoned order's units back where they were reserved from (inventory-reservation R4).
   * A plain increment: the guard exists to stop stock going below zero, and additions cannot.
   * Upsert, so a row removed since the reservation comes back rather than the units vanishing.
   *
   * A line with no location is a legacy shipment from before the cutover: its units go to the
   * product's largest current row, loudly, rather than nowhere.
   */
  async release(
    lines: ReadonlyArray<{ productId: string; orgAddressId: string | null; quantity: number }>,
    tx: ProductStockDb = prisma,
  ): Promise<void> {
    for (const line of lines) {
      let target = line.orgAddressId;
      if (!target) {
        const fallback = await tx.productStock.findFirst({
          where: { productId: line.productId },
          orderBy: { quantity: "desc" },
          select: { orgAddressId: true },
        });
        if (!fallback) {
          console.warn(
            `[stock.release] no stock row to restore ${line.quantity} of ${line.productId} (legacy shipment, no location) — correct manually`,
          );
          continue;
        }
        target = fallback.orgAddressId;
      }
      await tx.productStock.upsert({
        where: { productId_orgAddressId: { productId: line.productId, orgAddressId: target } },
        update: { quantity: { increment: line.quantity } },
        create: { productId: line.productId, orgAddressId: target, quantity: line.quantity },
      });
    }
    await stockChanged(tx, lines.map((l) => l.productId));
  }

  /**
   * Return a parcel's units to the location they left from — a returned or cancelled shipment
   * (shipment-lifecycle D6). The caller has already claimed `restockedAt` on the shipment, which
   * is what makes this run once; this only moves the units. A parcel with no location predates
   * the cutover and credits nothing. Increments existing rows only, as the shipping restock
   * always has.
   */
  async restockShipment(shipmentId: string, tx: ShipmentStockDb = prisma): Promise<void> {
    // Shipping's table, read here so the caller hands over an id rather than lines; the same
    // shape checkout's expiry already uses.
    const shipment = await tx.shipment.findUnique({
      where: { id: shipmentId },
      select: {
        orgAddressId: true,
        items: { select: { quantity: true, orderItem: { select: { productId: true } } } },
      },
    });
    if (!shipment?.orgAddressId) return;

    for (const item of shipment.items) {
      await tx.productStock.updateMany({
        where: { productId: item.orderItem.productId, orgAddressId: shipment.orgAddressId },
        data: { quantity: { increment: item.quantity } },
      });
    }
    await stockChanged(tx, shipment.items.map((i) => i.orderItem.productId));
  }

  /**
   * Take the row lock on this product's stock without moving any.
   *
   * The `increment: 0` is the point: an UPDATE locks every row it matches whether or not a
   * value changes, so a caller about to promise a unit elsewhere (bidding, archiving) serialises
   * against the order path, which locks the same rows when it reserves. Returns how many
   * locations still hold stock, so the caller's own check runs behind the lock, not in front.
   */
  async lockAll(productId: string, tx: ProductStockDb = prisma): Promise<number> {
    const locked = await tx.productStock.updateMany({
      where: { productId, quantity: { gte: 1 } },
      data: { quantity: { increment: 0 } },
    });
    return locked.count;
  }

  /**
   * A marketplace sale (inventory-sync D4, Q7): take up to `quantity` from a location, never below
   * zero, behind the row's lock. Returns what was taken; less than asked is an oversell the caller
   * records, never refuses: the sale already happened there.
   */
  async takeUpTo(productId: string, orgAddressId: string, quantity: number, tx: ProductStockDb = prisma): Promise<number> {
    const [row] = await tx.$queryRawUnsafe<Array<{ quantity: number }>>(
      `SELECT quantity FROM "ProductStock" WHERE "productId" = $1 AND "orgAddressId" = $2 FOR UPDATE`,
      productId,
      orgAddressId,
    );
    const taken = Math.min(row?.quantity ?? 0, quantity);
    if (taken > 0) {
      await tx.productStock.updateMany({ where: { productId, orgAddressId, quantity: { gte: taken } }, data: { quantity: { decrement: taken } } });
    }
    await stockChanged(tx, [productId]);
    return taken;
  }

  /** Take one unit from a named location, conditionally. `false` means nothing was there to take. */
  async takeOne(productId: string, orgAddressId: string, tx: ProductStockDb = prisma): Promise<boolean> {
    const taken = await tx.productStock.updateMany({
      where: { productId, orgAddressId, quantity: { gte: 1 } },
      data: { quantity: { decrement: 1 } },
    });
    if (taken.count === 1) await stockChanged(tx, [productId]);
    return taken.count === 1;
  }

  /**
   * The product editor's save: compare-and-set per location.
   *
   * The form sends what it saw (`seenQuantity`) beside what it wants, and each row is written
   * only where the database still holds the seen value — so a sale, return or import that landed
   * while the form was open is a refusal, not an overwrite. The previous delete-and-recreate
   * silently put the stock back to whatever the editor had loaded. Rows the editor saw are
   * updated (or removed, when set to 0: a zero row means "not stocked here" and is never kept);
   * rows it did not see are created; rows it did not send are left alone.
   */
  async adjust(
    productId: string,
    rows: readonly StockAdjustment[],
    tx: ProductStockDb = prisma,
  ): Promise<void> {
    for (const row of rows) {
      if (row.seenQuantity === undefined) continue;
      const where = { productId, orgAddressId: row.orgAddressId, quantity: row.seenQuantity };
      const written =
        row.quantity > 0
          ? await tx.productStock.updateMany({ where, data: { quantity: row.quantity } })
          : await tx.productStock.deleteMany({ where });
      if (written.count === 0) throw new ConflictError(STOCK_CHANGED_MESSAGE, { field: STOCK_FIELD });
    }

    const fresh = rows.filter((row) => row.seenQuantity === undefined && row.quantity > 0);
    if (fresh.length > 0) {
      try {
        await tx.productStock.createMany({
          data: fresh.map((row) => ({ productId, orgAddressId: row.orgAddressId, quantity: row.quantity })),
        });
      } catch (error) {
        // A row appeared at a location the editor saw as empty — the same staleness, found by the key.
        if (uniqueViolationFields(error)) throw new ConflictError(STOCK_CHANGED_MESSAGE, { field: STOCK_FIELD });
        throw error;
      }
    }
    if (rows.length > 0) await stockChanged(tx, [productId]);
  }

  /**
   * A bulk import's rows, as an absolute set: every listed product's rows are replaced by what
   * the sheet says. An import deliberately states the truth and may overwrite a concurrent sale —
   * the sheet is the org's count, and there is no "seen" value to compare against.
   */
  async setForImport(
    replaceForProductIds: readonly string[],
    rows: readonly Prisma.ProductStockCreateManyInput[],
    tx: ProductStockDb = prisma,
  ): Promise<void> {
    if (replaceForProductIds.length) {
      await tx.productStock.deleteMany({ where: { productId: { in: [...replaceForProductIds] } } });
    }
    if (rows.length) await tx.productStock.createMany({ data: [...rows] });
    await stockChanged(tx, [...replaceForProductIds, ...rows.map((r) => r.productId)]);
  }

  /**
   * Clear the join rows that hold nothing at a location about to be deleted. Rows with units
   * stay, so the location's FK RESTRICT refuses the delete — the caller turns that into a
   * message (stock-locations R8).
   */
  async dropEmptyAt(orgAddressId: string, tx: ProductStockDb = prisma): Promise<void> {
    await tx.productStock.deleteMany({ where: { orgAddressId, quantity: 0 } });
  }
}

export const stockRepository = new StockRepository();
