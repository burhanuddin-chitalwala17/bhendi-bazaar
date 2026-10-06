# CLAUDE.md — the front end

- **Verified:** 2026-10-06
- **Covers:** `src/components/**`, `src/hooks/**`, `src/app/globals.css`

> Read the root [`/CLAUDE.md`](../../CLAUDE.md) first. This file loads when a component is read, so its rules are in front of you while you write one. Each rule names the test that enforces it; a rule with no test says so.

## The layers

Each layer reads only from the one above. A component that skips a layer is the defect, whatever it renders.

| Layer | Lives in | Owns |
|---|---|---|
| Primitive palette | `src/app/globals.css`, the top `:root` block | Every colour value, named by family and lightness ([ADR-0049](../../docs/adr/0049-colour-is-a-primitive-palette-read-through-semantic-tokens.md)) |
| Semantic tokens | `globals.css` `:root` / `.dark` / `.portal` | What a colour, size or shape is *for* |
| Bridge | `globals.css` `@theme` | Turns tokens into Tailwind utilities |
| Primitives | `ui/` (shadcn) | One control each; appearance via variants |
| Wrappers | `shared/`, `layout/` | A primitive with project meaning: `PriceDisplay`, `PageShell`, `FormField` |
| Composites | `<domain>/` | A feature's UI, organised by domain, never audience ([ADR-0031](../../docs/adr/0031-one-components-home-organised-by-domain.md)) |
| Behaviour | hooks + `<domain>/*ApiClient.ts` | State in a hook, requests in a client ([ADR-0048](../../docs/adr/0048-a-component-renders-a-hook-holds-state-an-api-client-makes-the-call.md)) |
| Pages | `src/app/**/page.tsx` | Server components: read through `src/data-access-layer/`, pass props ([ADR-0034](../../docs/adr/0034-render-on-the-server-by-default.md)) |

## Behaviour

- **No `fetch` in a component, hook, context or store.** A request goes in its domain's `<thing>ApiClient.ts`, sends through `apiRequest` (`src/lib/api-client.ts`), throws `ApiError`, and never shows a toast or navigates. `tests/unit/api-clients.test.ts`
- **A component gets behaviour from a hook:** `useServerForm` for a form, `useMutation` for a click, `useAsyncData` for a read (it aborts the stale one). A hook does one thing. If a form needs its own `try/catch`, the hook is missing something; grow the hook ([ADR-0013](../../docs/adr/0013-one-error-envelope-and-useserverform.md)).
- **Props are DTOs.** Never `@prisma/client` or a repository, type-only included; shapes come from a domain's `*.types` or `src/domain/`. `tests/unit/module-boundaries.test.ts`
- **`"use client"` is earned by interactivity** and goes on the smallest leaf. A page or layout never has it. `tests/unit/rendering-strategy.test.ts`
- **A field and its error are bound together.** Every registered field shows its error. `tests/unit/form-error-display.test.ts`

## Appearance

- **Every control is a `ui/` primitive.** No raw `<button>`, `<select>` or text `<input>`; `type="file"` and `type="hidden"` are the only exceptions. Appearance comes from a variant, with only layout classes at the call site. `tests/unit/ui-primitives.test.ts`
- **A row-shaped `Button`** (two lines, an address, a menu item) states `h-auto whitespace-normal justify-start`. `tests/unit/button-rows.test.ts`
- **Every design axis is a semantic token:** colour, type size, tracking, elevation, shape, page width (`PageShell`/`PageHeader`). Never a palette class, an arbitrary `[…]` value, or a primitive like `--emerald-550`. `tests/unit/design-tokens.test.ts`
  - A new token in `globals.css` must also be registered in `cn`, or `tailwind-merge` silently drops it. `tests/unit/cn-tokens.test.ts`
  - Raw colour inside an arbitrary value (`bg-[radial-gradient(…rgba(…))]`) passes the suite. Review catches it, so don't write it.
- **An overlay's surface follows its content:** a picker uses `ResponsivePicker`, a canvas task `TaskDialog`. Only the files listed in the test reach for `SheetContent`. `tests/unit/overlay-surfaces.test.ts` ([ADR-0040](../../docs/adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md))
- **Images go through `next/image`.** `fill` needs a `sizes` that describes the real slot, never `100vw` on a thumbnail. A browser-direct upload downscales first. `tests/unit/image-delivery.test.ts` ([ADR-0026](../../docs/adr/0026-images-are-delivered-through-the-optimizer.md))

## Form factors

- **Phone at base, tablet from `md:`, desktop from `lg:`.** `sm:` only refines the phone. A script reads `FORM_FACTOR_QUERY` (`src/hooks/core/useMediaQuery.ts`), and a hand-written media query names one of 640/768/1024. `tests/unit/form-factors.test.ts` ([ADR-0050](../../docs/adr/0050-three-form-factors-on-tailwinds-own-breakpoints.md))
- **Mobile-first** ([ADR-0015](../../docs/adr/0015-mobile-first-design.md), [ADR-0016](../../docs/adr/0016-mobile-app-shell.md)). *No test; review checks it.*
  - single column at base, except `PRODUCT_GRID_CLASSES`;
  - a fixed element sits at `bottom-tabbar`;
  - `hidden md:*` on a primary action needs a phone affordance in the same change;
  - hover is never the only affordance;
  - targets ≥40px;
  - inputs keep `Input`'s 16px base.

## Where a new file goes

- **Used by one domain** → `<domain>/`, with its hook and client beside it.
- **Used by several, and it means something** (a price, a status) → `shared/`.
- **Page chrome** → `layout/`.
- **A generic hook** (`useDebounce`, `useMutation`) → `src/hooks/core/`.
- **Check `shared/` before writing a component.** Two of everything starts with not looking.
