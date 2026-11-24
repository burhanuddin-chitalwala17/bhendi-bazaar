# Contracts — cart

- **Verified:** 2026-11-24
- **Covers:** `server/cart/*.types.ts`

The cart shapes that cross the browser/server boundary. Rules, the error envelope and pagination are in
[CONTRACTS.md](../CONTRACTS.md); read those first.

## Cart
Since PR-44 the server stores only the buyer's choice per line (`CartLineInput`: product, quantity, size, colour) and **derives everything else from the product at read time** — prices, names, `weight`, `shippingFromPincode`, and the `org` block all come from the join, so a cart can no longer hold a stale or spoofed price and the boundary casts are gone. Since PR-45 there is **one `CartItem` declaration** (`server/cart/cart.types.ts`, re-exported by `src/domain/cart.ts`), satisfying Rule 1.
