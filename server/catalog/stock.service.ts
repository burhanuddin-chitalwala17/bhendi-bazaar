import { productsRepository, type ProductStockDb } from "@server/catalog/product.repository";

export type { ProductStockDb };

/**
 * Catalog's stock, as other domains are allowed to use it.
 *
 * Inventory lives in `catalog` but is *moved* by whoever is selling: `checkout` reserves it
 * inside the order transaction, `bidding` locks it while an event opens and takes a unit when
 * one is won. Before this existed, those callers imported `product.repository` directly —
 * reaching past the service that owns the rules, which
 * [ADR-0033](../../docs/adr/0033-a-domain-is-reached-through-its-public-surface.md) forbids and
 * which left "how is stock moved" answerable in two places.
 *
 * **Every operation takes the caller's transaction.** These are not standalone writes: a
 * reservation that commits separately from the order it belongs to is the bug
 * [ADR-0007](../../docs/adr/0007-conditional-stock-decrement.md) exists to prevent. Passing
 * `tx` is how the guard and the write stay one statement inside one transaction.
 */
export const stockService = {
  /**
   * Where this product physically is, at active locations with something left. The read the
   * allocator and the bidding picker both start from.
   */
  stockByLocation: (productId: string, db?: ProductStockDb) =>
    productsRepository.stockByLocation(productId, db),

  /**
   * Take the row locks for this product's stock without changing anything.
   *
   * A no-op `increment: 0` on every row, which is how you acquire the locks a later check must
   * be ordered behind. `bidding` uses it so that opening an event and reserving stock for a
   * sale cannot interleave — see `server/checkout/sale-gates.ts` for the other half of that
   * ordering. Returns how many rows were locked.
   */
  lock: (productId: string, db?: ProductStockDb) =>
    productsRepository.lockStock(productId, db),

  /**
   * Take one unit from a named location, conditionally (Invariant 6). `false` means there was
   * nothing there to take — the guard and the decrement are one statement, because
   * read-then-write is a race rather than a check.
   */
  takeOneFromLocation: (productId: string, orgAddressId: string, db?: ProductStockDb) =>
    productsRepository.takeOneFromLocation(productId, orgAddressId, db),
};
