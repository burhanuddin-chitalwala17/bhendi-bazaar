# TRD — dashboard widgets

- **Status:** ✅ Implemented (PR-50)
- **Domain:** analytics, cross-domain
- **Phase:** 3 — Fulfilment
- **Verified:** 2026-08-10
- **References:** [spec.md](spec.md), [../portal-split.md](../portal-split.md), [order-and-cart-lines](../order-and-cart-lines/trd.md), [CLAUDE.md](../../../../CLAUDE.md)

> Technical approach and decisions. No code — references to existing code only.

## Approach
A registry in the analytics domain — one `WidgetDefinition` per widget: key, title,
**audience**, a one-line **scope** statement (required exactly when the audience is
`both`), and a `fetch(ctx)` that runs the audience-gated query. One server component
renders the grid for whichever portal asks; the pages own nothing but the call.

## Technical decisions
- **D1 — Definitions live in `server/analytics/`** — the documented read-only exception to no-cross-domain-reads, which is precisely what a dashboard is. Fetchers read Prisma directly, like the rest of that domain.
- **D2 — The gate is structural, not conventional.** `widgetsFor(audience)` filters the registry, and `fetchWidget` throws if an org context ever reaches a platform-only widget — R3 enforced at the seam rather than remembered per page. A widget's data is fetched server-side in an RSC; no widget API exists, so a number an org may not see has no route to the browser.
- **D3 — A definition returns `{ kind, value }`, the UI formats.** `server/` must not import `src/` (dependency direction), so money crosses as integer paise with `kind: "money"` and the grid formats via `src/lib/format` — the same one-formatter rule as everywhere (ADR-0004).
- **D4 — Failure is per widget** (R5): the grid `Promise.allSettled`s the fetches; a rejected widget renders an error card and the log keeps the cause.
- **D5 — Org revenue is the org's parcels' item value on paid orders**, summed from `ShipmentItem × OrderItem.unitPrice` — the attribution [order-and-cart-lines](../order-and-cart-lines/trd.md) exists to make possible. Shipping is deliberately excluded: the platform collects it against courier invoices that do not yet exist ([shipping-fulfilment](../../shipping-fulfilment/) owns that story).
- **D6 — The admin dashboard's key-metrics row moves onto the registry** (a `customers` widget added so nothing is lost) and is server-rendered. The period-revenue breakdown, order-status overview and activity feed are platform richness the registry doesn't model — they stay a client island on the existing stats endpoints, keeping refresh and auto-refresh.

## Packages
None.

## Data model
None.

## API / contract changes
None new — the admin stats endpoint loses its dashboard caller (kept for now; removal is a later cleanup). No widget endpoint exists, by design (D2).

## Test plan
- Registry invariants: keys unique; every `both` widget declares its scope; `widgetsFor` never yields a platform widget for an org.
- The structural gate: `fetchWidget` refuses an org context on a platform-only widget.
- Grid behaviour is RSC composition — covered by the invariants above plus build.

## Delivery (PRs)
One PR: registry + grid + both dashboards on it.

## Open questions
None.
