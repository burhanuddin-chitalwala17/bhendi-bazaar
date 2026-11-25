# TRD — checkout-links

- **Status:** Accepted
- **Domain:** cart, with checkout
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-23
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](ux.md), [ADR-0002](../../adr/0002-server-holds-pricing-authority.md), [ADR-0063](../../adr/0063-every-public-route-is-classified-for-rate-limiting-in-one-registry.md), the cart (`server/cart/cart.service.ts`, `server/cart/cart.merge.ts`)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
A link is a short random token pointing at a `CheckoutLink` row that holds products and quantities,
never prices. Opening it adds the items to the buyer's cart once (claimed per cart), marks them as
from the link, and opens checkout, which prices everything as it always does.

## Prior art
- **Shopify cart permalinks** carry variant ids and quantities, never prices, and the cart prices
  them. Followed, with a stored row instead of ids in the URL so a link cannot be edited and its
  source and order can be recorded (Q3).

## Technical decisions
- **D1 — Model (R1, R7, Q3).** `CheckoutLink(id, token UNIQUE (22 chars, 128-bit random,
  base64url), orgId, items JSON [{productId, quantity}], source INBOX_ORDER|AUTOMATIC|CAMPAIGN,
  sourceRef, displayPricesPaise (each item's price when made, shown only, never charged), expiresAt
  (7 days, Q1), orderId nullable, createdAt)`. `cart.checkoutLinks.create` is
  the public surface inbox, automations and campaigns call.
- **D2 — Tamper-proof (R2).** The URL is `/c/<shop slug>/<token>`: the token is random and looked
  up together with the shop; an unknown or edited token opens that shop's page with no message, and
  nothing is created. A guessed token is a 2^128 search, and the route is rate-limited.
- **D3 — Open once (R3, Q2).** `GET /c/[shop]/[token]` (rate-limited per address under a new `link` policy,
  ADR-0063): expired → the products' pages with the line (R5); else in one transaction add the items
  to the buyer's cart (guest cookie or account, existing cart service) guarded by a
  `CheckoutLinkOpen(linkId, cartId)` unique row, so opening again adds nothing; set `fromLinkId` on
  the added cart lines; redirect to checkout.
- **D4 — Checkout shows it (R3, R4).** Checkout's read groups lines with `fromLinkId` under "From
  your chat with <shop>", others under "Already in your cart"; an out-of-stock link item is not added
  and the note names it; a price changed since creation shows "Now ₹x (was ₹y when sent)" by
  comparing with a price snapshot taken at link creation for display only (never charged).
- **D5 — Order attribution (R7).** On order placement, checkout records `orderId` on the links whose
  lines were in it (through cart's public surface).
- **D6 — Size step.** A link for a family product without a size opens a small page to pick one, then
  continues as D3.

## Packages
None.

## UI approach
ux.md's checkout grouping and notes (existing checkout components gain the two groups), the size
step page, the expired line on product pages. Words in checkout's copy module.

## Gates touched
Public route classified; `EXTERNALLY_CALLED` (links in chats); one repository each.

## Data model
[MIGRATION] `CheckoutLink`, `CheckoutLinkOpen`; cart line `fromLinkId`.

## API / contract changes
[CONTRACT] `checkoutLinks.create` DTO.

## Test plan
- A link opens checkout with its items at today's prices (A1); an out-of-stock item left out (A2).
- Existing cart items shown removable; second open adds nothing (A3).
- Unknown or edited token → that shop's page; expired → products with the line (A4).
- A price in the stored snapshot is never charged (100%: pricing authority).

## Delivery
1. **independent** — Model, create, open-once (behaviour).
2. **after U1** — Checkout grouping and notes, size step, attribution.

## Open questions
None.
