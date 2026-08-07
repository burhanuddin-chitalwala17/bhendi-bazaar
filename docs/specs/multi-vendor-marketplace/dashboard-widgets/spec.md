# Spec — dashboard widgets

- **Status:** Not drafted — scope and two decisions agreed, requirements provisional, no TRD yet
- **Domain:** analytics, cross-domain
- **Phase:** 3 — Fulfilment
- **Verified:** 2026-08-08
- **Depends on:** portal-separation; money widgets additionally on order-and-cart-lines
- **References:** [../spec.md](../spec.md), [../portal-split.md](../portal-split.md), [order-and-cart-lines](../order-and-cart-lines/)

> Requirements and product approach only. A `trd.md` is written when this subfeature is picked up.

## What this feature is
One dashboard, assembled from widgets. Each widget declares who it is for, so what an organisation sees
and what a platform owner sees is a declaration in one place rather than a fork in the page.

## Why it is separate
[../portal-split.md](../portal-split.md) classifies the dashboard as serving both audiences, which would
otherwise mean two pages drifting apart. A widget registry makes the audience a property of the widget —
the same instinct as declaring a closed set once ([CLAUDE.md](../../../../CLAUDE.md)). It is small, it has
real design in it, and folding it into `portal-separation` would bloat the largest spec in the programme.

## Requirements (provisional)
- **R1** — A widget declares its audience: platform, organisation, or both.
- **R2** — A widget available to both declares how it is scoped, so an organisation's "orders" means its own and a platform owner's means all of them.
- **R3** — The audience decides what is **fetched**, not only what is rendered. A number an organisation may not see never reaches the browser.
- **R4** — Adding a widget is adding one declaration. No page is edited to make it appear.
- **R5** — A widget whose data is unavailable fails alone, leaving the rest of the dashboard usable.

## Decisions taken (2026-08-08)
- **The audience gates the query.** Returning every widget's data and filtering client-side would disclose platform figures to an organisation whether or not they are drawn — the same reasoning that keeps per-location stock off customer responses.
- **A "both" widget carries a scope, not just inclusion.** Scoping is stated per widget rather than as a global filter a new widget could forget to apply.

## Known dependency
Money widgets for an organisation are blocked on [order-and-cart-lines](../order-and-cart-lines/).
Revenue is read from `Order.grandTotal` today, and no part of a cross-vendor order can be attributed to
one organisation without order lines. Count-based widgets — products, stock, pending shipments — work
before that lands; revenue and average-order-value do not.
