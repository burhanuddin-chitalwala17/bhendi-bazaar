# CLAUDE.md — the front end

- **Verified:** 2026-11-05
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
- **A double tap is one request.** `useMutation` joins a call already in flight *with the same variables* (another row is another request); `useServerForm` joins any second submit. A busy control is `Button pending` (buttons only, not `asChild`), never `disabled`, and the `disabled={…busy}` count only falls. `apiRequest` times out at 30 s, or `TRANSFER_TIMEOUT_MS` for files and bulk rows, and a write that timed out says it may still land. `tests/unit/double-submit.test.tsx`
- **The cart is read after mount.** `hasHydrated` is false through the first render; anything that acts on the cart once (a checkout snapshot, the sign-in merge) waits for it, and nothing is saved before it is read. `tests/unit/double-submit.test.tsx`

## Appearance

- **Words and our own paths are constants.** What a person reads (JSX text, `title`/`label`/`placeholder`/`aria-label`/`alt`, toasts) lives in the area's `*-copy.ts`; a link to one of our pages is `ROUTES.…` from `server/shared/routes.ts`. `tests/unit/hardcoded-copy.test.ts` ([ADR-0067](../../docs/adr/0067-words-live-in-copy-modules-and-our-own-paths-in-one-routes-table.md))
- **Every control is a `ui/` primitive.** No raw `<button>`, `<select>` or text `<input>`; `type="file"` and `type="hidden"` are the only exceptions. Appearance comes from a variant, with only layout classes at the call site. `tests/unit/ui-primitives.test.ts`
- **Every icon is `<Icon name size>` from `ui/icon.tsx`**, named for its meaning (`close`, `success`, `bag`); only `ui/icons/` imports a library or holds a drawing. Without `label` it is decoration; an icon-only button carries `aria-label`. A busy button is `Button pending`, inline progress is `Spinner`, a loading page is a skeleton. `tests/unit/icons.test.ts` ([ADR-0066](../../docs/adr/0066-the-ui-is-built-in-tiers-and-every-icon-goes-through-one-seam.md))
- **Variants are one `cva` map per primitive, one prop per axis** (`variant`, `size`, `shape`, `tone`, `density`); combinations are `compoundVariants`; a composite passes axes through, never restyles. Adding a variant is one entry. *Review checks it.* ([ADR-0066](../../docs/adr/0066-the-ui-is-built-in-tiers-and-every-icon-goes-through-one-seam.md) D8)
- **Type is a role:** `text-display`, `-headline`, `-title`, `-body`, `-small`, `-caption`, `-label` (with `uppercase`, once per section). Nothing below `text-2xs` (11px). Motion is `duration-fast|base|slow` and `ease-standard|emphasised`. `tests/unit/design-tokens.test.ts`
- **A page is built from the page grammar in `shared/`:** one `PageHeader` (the only h1; `SectionHeader` is h2/h3), one `ActionBar` for its primary actions, `EmptyState`/`ErrorState` with one action (an href from a server page), skeletons from `states/skeletons` (no page spinner), `PageTabs` for route filters, `StatusBadge` for every status chip, `ResourceList` for any list of records (rows on a phone, a table from `md:`, sort in the URL), `SelectionBar` for bulk actions. A hand-rolled sticky bar, chip or table is the defect. `tests/unit/page-grammar.test.tsx`
- **The logo is `<BrandLogo>`** (`layout/brand-logo.tsx`), inverted on dark surfaces. Another platform's mark (Amazon, Google, Meta…) is `PlatformMark` from `ui/icons/platform-marks.tsx`, drawn in that platform's own colours; a channel surface reaches it through `channel/channel-mark.tsx`.
- **A row-shaped `Button`** (two lines, an address, a menu item) states `h-auto whitespace-normal justify-start`. `tests/unit/button-rows.test.ts`
- **Every design axis is a semantic token:** colour, type size, tracking, elevation, shape, page width (`PageShell`/`PageHeader`). Never a palette class, an arbitrary `[…]` value, or a primitive like `--emerald-550`. `tests/unit/design-tokens.test.ts`
  - A new token in `globals.css` must also be registered in `cn`, or `tailwind-merge` silently drops it. `tests/unit/cn-tokens.test.ts`
  - Raw colour inside an arbitrary value (`bg-[radial-gradient(…rgba(…))]`) passes the suite. Review catches it, so don't write it.
- **An overlay's surface follows its content:** a picker uses `ResponsivePicker`, a canvas task `TaskDialog`, a short handed-off flow (hint, share, pickup address) `HandoffSheet`. Only the files listed in the test reach for `SheetContent`. `tests/unit/overlay-surfaces.test.ts` ([ADR-0040](../../docs/adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md))
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
