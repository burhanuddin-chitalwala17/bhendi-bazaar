# ADR-0034: Render on the server by default, and never mark a page `"use client"`

- **Date:** 2026-09-23
- **Status:** Accepted

## Context

[CLAUDE.md](../../CLAUDE.md) has said since the App Router migration that `"use client"` is
"earned by interactivity" and should be "pushed down to the smallest leaf." Measured on
2026-09-23: **106 of the 173 components under `src/components` carry `"use client"` (61%; 121 of
248 across all of `src/`), ten `page.tsx` files are themselves client components, and so is one
`layout.tsx`.**

```
(main)/profile        (main)/orders         (auth)/reset-password
(admin)/carts         (admin)/users         (admin)/orders   (admin)/orders/[orderId]
(admin)/categories    (admin)/categories/[id]/edit           (admin)/reviews
```

A `"use client"` on a page opts its entire subtree out of server rendering, and that has a
cost the file count makes visible. A server component reads through
`src/data-access-layer/` and renders: **two files**. A client page cannot reach the database,
so the same data must travel page → hook → client service → route handler → Zod schema →
domain service: **six or seven files, for the same screen.**

That is the mechanism behind commits touching thirty files. It is also why `src/app/api`
holds 93 route handlers, several of which exist for no reason other than that a client
component needed to read something a server component was already able to read — the round
trip [CLAUDE.md](../../CLAUDE.md) calls "bought for nothing," and the reason a page shows a
spinner over data the server already had.

The admin console is the clearest case: seven of the ten client pages are admin list screens
whose interactivity is a filter bar and a table. The filters need state; the rows do not.

## Decision

1. **A `page.tsx` is never a client component.** No exceptions — a page that needs
   interactivity composes a client leaf, which is a smaller change than it sounds because the
   leaf usually already exists.
2. **A `layout.tsx` is never a client component**, for the same reason and with a wider blast
   radius.
3. **Server components read through `src/data-access-layer/`.** A page importing a repository
   directly skips the layer that exists to keep pages out of Prisma; seven do today.
4. **A route handler exists for something a browser must call** — a mutation, or a fetch
   triggered by interaction. Reading data a server component could have read is not a reason
   for one.
5. **`tests/unit/rendering-strategy.test.ts` enforces 1–3 as a ratchet.** The client pages and
   layouts are allowlisted with the work each needs; the lists may shrink and never grow.
6. **There is deliberately no ceiling on the number of client components.** One was written and
   removed the same day: converting `admin/users` into a server page plus two client leaves — a
   filter bar and a table — is a strict improvement and *raised* the file count. A tally of
   client files punishes the refactor it exists to encourage, because pushing `"use client"`
   down to the leaves necessarily creates leaves. The boundary is the rule; the tally was noise.

## Alternatives considered

- **Leave it and write better guidance.** This is what we had, in the always-loaded rules
  file, and the tree reached 61% client under it.
- **Convert all ten pages now.** Rejected as scope — several are genuine refactors with real
  regression risk on the admin console, and bundling them into an enforcement change is how a
  gate arrives broken and gets disabled. The ratchet makes them a visible, bounded backlog.
- **A lint rule** (`react-server-components` plugins, or a custom `no-restricted-syntax`).
  Close, and rejected for the same reason as [ADR-0033](0033-a-domain-is-reached-through-its-public-surface.md):
  lint is `continue-on-error: true` in CI here, so it advises rather than enforces.
- **Accept client-first and delete the rule.** The honest alternative, and worth stating: a
  fully client-rendered SPA is a coherent architecture. Rejected because this is a storefront
  whose primary buyer is on a phone on a slow connection
  ([ADR-0015](0015-mobile-first-design.md)), and because the project already pays for server
  rendering — every route is dynamic, there is no ISR, and the data-access layer exists. We
  are paying for the architecture and not taking it.

## Consequences

- ✅ New screens default to two files instead of seven, which is the direct answer to diffs
  that touch thirty.
- ✅ Fewer route handlers, so a smaller authenticated surface to get wrong.
- ✅ Less JavaScript to a phone, which is the buyer this store is designed for.
- ⚠️ Ten allowlisted pages, each needing a real conversion. That is the backlog, and the
  admin list screens should go first — they share one shape, so the first is the pattern for
  the rest.
- ⚠️ The rule says nothing about how much of a page ends up in its leaves. A page can satisfy
  it by delegating everything to one enormous client component. What stops that is the
  reviewer, not this gate.
