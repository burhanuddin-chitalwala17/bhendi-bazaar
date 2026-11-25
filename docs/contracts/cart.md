# Contracts — cart

- **Verified:** 2026-11-25
- **Covers:** `server/cart/*.types.ts`

The cart shapes that cross the browser/server boundary. Rules, the error envelope and pagination are in
[CONTRACTS.md](../CONTRACTS.md); read those first.

## Cart
Since PR-44 the server stores only the buyer's choice per line (`CartLineInput`: product, quantity, size, colour) and **derives everything else from the product at read time** — prices, names, `weight`, `shippingFromPincode`, and the `org` block all come from the join, so a cart can no longer hold a stale or spoofed price and the boundary casts are gone. Since PR-45 there is **one `CartItem` declaration** (`server/cart/cart.types.ts`, re-exported by `src/domain/cart.ts`), satisfying Rule 1.

A line may carry `fromLinkId`, the checkout link that added it. It is a display mark only: the server keeps it when the link exists and drops it otherwise, and it never touches a price.

## Checkout links
`checkoutLinkService.create` (`server/cart/checkout-link.service.ts`) is what inbox, automations and campaigns call. Its input, `createCheckoutLinkInput` in `server/cart/checkout-link.types.ts`, is the shop, one to twenty of its on-sale products each with a quantity of 1–99 and an optional `pickSize` (the buyer picks the size among the product's family when opening, D6), the `source` (`INBOX_ORDER`, `AUTOMATIC`, `CAMPAIGN`) and an optional `sourceRef`. **There is no price in it** (Invariant 1). It returns `CreatedCheckoutLink`: the id, the token, the absolute `url` to send, and `expiresAt` (seven days).

`POST /api/checkout-links/open` takes `{ shop, token, sizes? }` (`sizes`: products picked on the size step, honoured only among the family's sizes in stock) and answers `OpenCheckoutLinkResult`: `unknown`, `expired` with the first product's slug, or `opened` with today's priced lines (each marked `fromLinkId`), the items left out by name, and `alreadyOpened` when this cart opened it before (then no lines). Nothing to add claims nothing.

`POST /api/checkout-links/notes` takes `{ links: [{ linkId, productIds }] }` (the lines a checkout holds, by the link that marked them) and answers `CheckoutLinkNote[]`: the shop's name and handle, the link's items neither held nor addable now (`leftOut`), and each held line whose price moved since the link was made (`priceChanges`, paise, display only).

`checkoutLinkService.recordOrderIn(tx, orderId, marks)` is what checkout calls inside the order transaction: each `{ linkId, orgId }` records the order on that shop's link, never over an order already paid.
