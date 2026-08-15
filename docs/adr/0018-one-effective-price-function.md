# ADR-0018: One effective-price function serves display and charge

- **Date:** 2026-08-16
- **Status:** Accepted
- **Context:** Until now the only way to reduce a price was `Product.salePrice`, read independently wherever a price is shown. Those readings already disagree: `src/components/shared/PriceDisplay.tsx` treats a sale price as an offer only when it is positive and below the regular price — matching `effectiveUnitPrice` in `server/checkout/pricing.ts` — while the cart line, the checkout summary, the shipping-rate hook and five other sites simply fall back with `??`. A sale price of zero, or one above the regular price, renders differently depending on where the buyer is looking.

  [promotions](../specs/promotions/) multiplies that surface. Offers are time-boxed and reduce the price shown on listings, the product page and the cart, so a price is now derived from a catalogue row, a set of live offers, and a clock — at every read path in the storefront rather than at one. The force is not malice but arithmetic: a storefront that advertises a price the server will not honour is exactly the failure [ADR-0002](0002-server-holds-pricing-authority.md) exists to prevent, and it arrives through two implementations drifting apart, which is what nine of them have already done over one nullable column.
- **Decision:**
  1. **One function resolves an item's effective price** from its catalogue row, the active offer set, and an instant. Every surface calls it — the data-access layer, listings, the product page, the cart, the checkout preview, and the order transaction.
  2. **It takes the clock as an argument** rather than reading it, so the same instant prices a preview and the transaction that follows it. A function that reads `now()` internally cannot be asked "what did this cost at 6pm", which is what an expiry dispute needs.
  3. **Offer resolution is cached no longer than a request.** Prices now change on a clock; any cache outliving an offer boundary serves a price the server will refuse.
  4. **`Product.salePrice` is removed.** A markdown becomes an organisation-funded, product-targeted offer, so there is one reduction mechanism rather than two that must be kept consistent.
  5. **A read path that needs a price and does not call this function is a defect**, not an optimisation.
- **Alternatives considered:**
  - *Resolve offers only at checkout and leave display on catalogue prices* — the cheaper answer and the conventional one: an order-level discount line is how most stores show a coupon, and it touches one code path instead of every listing query. Rejected on the product requirement: an automatic sale nobody can see does not sell anything. A price cut that appears for the first time on the payment screen is a different feature from a sale.
  - *Two implementations — one tuned for listings, one for the transaction* — rejected, because that is a description of the drift rather than a way to avoid it. The nine current readings of `salePrice` were also not intended to disagree.
  - *Materialise the promoted price onto `Product` with a scheduled job* — genuinely attractive for read performance, and rejected on correctness: offers start and end on a clock, so a materialised price is wrong for the whole window between a boundary and the next run, and wrong invisibly. It also reintroduces two sources of truth, which is the thing being removed.
  - *Keep `salePrice` beside offers as a separate concept* — the initial recommendation, and reversed once funding splits were specified ([ADR-0019](0019-discount-is-one-winning-offer.md)). A markdown is an organisation's own offer; one that sits outside the comparison can be neither weighed against a platform offer nor attributed to whoever paid for it.
- **Consequences:**
  - ✅ A divergence between the advertised price and the charged price stops being expressible, rather than being caught by review.
  - ✅ The nine-site disagreement over `salePrice` is fixed as a by-product of routing them through one function, rather than as separate remedial work.
  - ✅ Markdowns and campaigns share one clock, so "all offers are time-boxed" holds without an exception.
  - ⚠️ Price resolution moves onto every listing render. This is affordable only because live offers are a small set loaded once per request and matched in memory — a per-product query here would be fatal, and is the failure mode to watch for.
  - ⚠️ Caching acquires a correctness constraint it did not have. Response caching and ISR must not outlive an offer window.
  - ⚠️ 42 files reference `salePrice`. Most are display and collapse into a shared component, but the migration is broad and lands as its own PR for that reason.
