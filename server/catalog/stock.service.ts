import {
  stockRepository,
  type ProductStockDb,
  type ShipmentStockDb,
  type StockAdjustment,
  type StockLine,
} from "@server/catalog/stock.repository";

export type { ProductStockDb, StockAdjustment, StockLine };

/**
 * Catalog's stock, as other domains are allowed to use it.
 *
 * Inventory lives in `catalog` but is *moved* by whoever is selling: `checkout` reserves it
 * inside the order transaction and releases it when the order expires, `shipping` returns it
 * when a parcel comes back, `bidding` locks it while an event opens and takes a unit when one
 * is won. Each used to write the table itself; this is the one seam
 * ([ADR-0033](../../docs/adr/0033-a-domain-is-reached-through-its-public-surface.md)), over the
 * one repository ([ADR-0003](../../docs/adr/0003-one-repository-per-aggregate.md)).
 *
 * **Every operation takes the caller's transaction.** A reservation that commits separately from
 * the order it belongs to is the bug
 * [ADR-0007](../../docs/adr/0007-conditional-stock-decrement.md) exists to prevent. Passing `tx`
 * is how the guard and the write stay one statement inside one transaction.
 */
export const stockService = {
  /** Where this product physically is, at active locations with something left. */
  stockByLocation: (productId: string, db?: ProductStockDb) =>
    stockRepository.stockByLocation(productId, db),

  /** Where these products are, with each location's org and geography — the allocator's input. */
  onHandByLocation: (productIds: string[], db?: ProductStockDb) =>
    stockRepository.onHandByLocation(productIds, db),

  /**
   * Reserve each line conditionally (Invariant 6). Returns the first product that could not be
   * reserved, or null. Lines must already be in `reservationPlan` order.
   */
  reserve: (lines: readonly StockLine[], tx?: ProductStockDb) => stockRepository.reserve(lines, tx),

  /** Put an abandoned order's units back where they were reserved from. */
  release: (
    lines: ReadonlyArray<{ productId: string; orgAddressId: string | null; quantity: number }>,
    tx?: ProductStockDb,
  ) => stockRepository.release(lines, tx),

  /** Return a cancelled or returned parcel's units to its location. The caller claims the once-only. */
  restockShipment: (shipmentId: string, tx?: ShipmentStockDb) =>
    stockRepository.restockShipment(shipmentId, tx),

  /**
   * Take the row locks for this product's stock without changing anything — what a later check
   * must be ordered behind. `bidding` uses it so opening an event and reserving stock for a sale
   * cannot interleave; see `server/checkout/sale-gates.ts` for the other half.
   */
  lockAll: (productId: string, tx?: ProductStockDb) => stockRepository.lockAll(productId, tx),

  /**
   * Set counted stock per location against the counts the editor saw (Invariant 6): a sale in
   * between refuses the whole write. A location with no row yet has no seen count.
   */
  setCounted: (productId: string, rows: readonly StockAdjustment[], tx?: ProductStockDb) =>
    stockRepository.adjust(productId, rows, tx),

  /** Take one unit from a named location, conditionally. `false` means nothing was there. */
  takeOne: (productId: string, orgAddressId: string, tx?: ProductStockDb) =>
    stockRepository.takeOne(productId, orgAddressId, tx),
};
