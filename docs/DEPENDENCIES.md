# DEPENDENCIES.md — dependency registry

- **Verified:** 2026-11-08
- **Covers:** `package.json`

`package.json` says *what*. This file says *why*, *who uses it*, and *when it was last checked*.

## Update rules
- Any PR adding a package adds a row here and states the reason in its TRD ([../CLAUDE.md](../CLAUDE.md) — a new package requires one).
- Any PR bumping a major version updates `Verified` and notes behaviour changes.
- Removing a package: move its row to `## Removed` with the date and reason. Do not delete the row.
- **Run `npm audit --omit=dev` before every release.** Advisory state changes weekly, so it is not recorded here — the command is the source of truth, not a snapshot. Note version-pinning constraints in the `Notes` column instead.

---

## Runtime

| Package | Pinned | Why | Used by | Verified |
|---|---|---|---|---|
| `pg-boss` | `^12.34.0` | The job queue, as tables in our own Postgres ([ADR-0038](adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md)). Reached only through `server/shared/jobs/`; its schema is applied by our migrations, never by the library. One-person project, which is one reason it sits behind a seam | `server/shared/jobs/`, `worker/` | 2026-09-26 |
| `next` | `16.4.3` | Framework: App Router, RSC, route handlers. Pinned exactly, not caretted — a framework minor arriving on a lockfile refresh is not something to leave to chance. **≥16.4.1 is required**: earlier 16.x is open to GHSA-2464-fhr4-w9xw (unauthenticated RCE through Image Optimization); `tests/unit/deploy-safety.test.ts` holds the floor | Everything | 2026-10-31 |
| `ajv` | `8.17.1` | JSON Schema validation: an Amazon listing is checked against the type's own stored schema before any call, so a refusal is named to the shop without a round trip ([listing-model/field-maps](specs/listing-model/field-maps/trd.md) D6). Draft 2019-09 build (`ajv/dist/2019`), `strict: false` so Amazon's own keywords are ignored as its documentation allows. Pinned exactly | `server/channels/providers/amazon/amazon.shape.ts` | 2026-11-08 |
| `react` / `react-dom` | `19.2.1` | UI runtime | Everything | 2026-08-03 |
| `@prisma/client` / `prisma` | `^7.10.1` | Type-safe DB access; migrations. **The two must be bumped together** — `npm audit fix` once moved the CLI alone and every query died with `Cannot find module './query_compiler_fast_bg.js'` | `server/<domain>/*.repository.ts` | 2026-09-21 |
| `@prisma/adapter-pg` + `pg` | `^7.10.1` / `^8.16.3` | Driver adapter — Prisma 7 reaches Postgres through `pg`. **Version-locked to `prisma`.** It also decides the *shape* of a constraint error: 7.10 reports a P2002's constraint by name where 7.1 reported its columns, which is why `server/shared/constraint.ts` reads both and `tests/unit/constraint-shapes.test.ts` pins them | `server/shared/prisma.ts` | 2026-10-31 |
| `next-auth` | `^4.24.13` | Sessions, credentials + Google OAuth, JWT strategy | `src/lib/auth-config.ts` | 2026-08-03 |
| `@auth/prisma-adapter` | `^2.11.1` | Persists NextAuth `Account` / `Session` / `VerificationToken` | `src/lib/auth-config.ts` | 2026-08-03 |
| `bcryptjs` | `^3.0.3` | Password hashing. Cost 10 | `server/identity/password.service.ts` | 2026-08-03 |
| `zod` | `^4.6.6` | Runtime validation at the HTTP boundary — the mechanism behind [Invariant 4](../CLAUDE.md). Floor is GHSA-mrhx-c7xc-m3w5 (memory exhaustion validating oversized collections), which matters because zod parses every request body | `src/lib/validation/**` | 2026-10-31 |
| `zustand` | `^5.0.9` | Cart state with localStorage persistence. Chosen for size and minimal boilerplate | `src/store/cartStore.ts` | 2026-08-03 |
| `@upstash/ratelimit` + `@upstash/redis` | `^2.0.7` / `^1.36.0` | Distributed rate limiting. Required because Vercel runs many instances, so in-memory counters do not hold. **Reads `RATE_LIMIT_STORE_*`, falling back to `KV_REST_API_*`; never `UPSTASH_REDIS_REST_*`** | `src/lib/rate-limit/upstash.ts` | 2026-08-03 |
| `aws4fetch` | `^1.0.20` | Signs S3 requests to Cloudflare R2 — server-side PUT/DELETE and the presigned PUT a browser uploads with ([ADR-0028](adr/0028-images-live-in-cloudflare-r2.md)). Chosen over `@aws-sdk/client-s3` + `s3-request-presigner`: two packages and several MB, against one file, for two verbs | `server/catalog/object-store.ts` | 2026-09-17 |
| `sharp` | `^0.35.5` | Downscale and re-encode uploads before they reach R2 ([ADR-0026](adr/0026-images-are-delivered-through-the-optimizer.md)). Present as a Next transitive dependency before this; declared so the version we rely on is ours. **Note:** ships a platform binary, so nothing that calls it may leave the Node.js runtime — which now includes the **worker**, not only the upload routes | `server/catalog/image-upload.ts`, `server/catalog/media-asset.service.ts`, `server/catalog/media-backfill.ts`, and the seven tools in `server/content/tools/` | 2026-09-28 |
| `exceljs` | `^4.4.0` | Reads and writes the bulk-upload sheets (.xlsx/.csv) and generates the per-org sample. Chosen over npm `xlsx`/SheetJS, whose free build is unmaintained with unfixed parser advisories — this parses user-supplied files | `server/catalog/bulk/**` | 2026-08-21 |
| `libphonenumber-js` | `^1.13.13` | Validates, normalises to E.164 and formats phone numbers for every country. Imported as `/max`: `min` metadata validates most countries by length alone and accepts numbers the Indian rule refused (international-phone (`431ed6e7:docs/specs/international-phone/trd.md`) D1) | `server/shared/phone.ts` only | 2026-09-11 |
| `resend` | `^6.6.0` | Transactional email | `server/notifications/email.service.ts` | 2026-08-03 |
| `react-hook-form` + `@hookform/resolvers` | `^7.68.0` / `^5.2.2` | Admin form state with Zod resolvers | `src/components/shared/forms/**` | 2026-08-03 |
| `@radix-ui/*` | various | Accessible primitives behind shadcn/ui: dialog, dropdown-menu, popover, separator, slot, switch. `popover` added for the anchored half of every picker ([ADR-0040](adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md) decision 1) — focus, escape and outside-click behaviour a hand-rolled one gets wrong. `dropdown-menu` added for row actions and the copy picker (copy-product (`431ed6e7:docs/specs/copy-product/trd.md`)) — keyboard navigation, typeahead and collision-aware positioning are what a hand-rolled menu gets wrong | `src/components/ui/**` | 2026-09-27 |
| `lucide-react` | `^0.561.0` | Icons | Throughout UI | 2026-08-03 |
| `react-day-picker` | `^10.0.1` | The calendar behind the one date-range field (media-library (`431ed6e7:docs/specs/media-library/trd.md`) UI approach): range selection, keyboard and screen-reader behaviour, month navigation — the parts of a calendar that go wrong when hand-rolled. Styled through our tokens via `classNames`, its own stylesheet unused. Brings `date-fns`, used nowhere else | `src/components/ui/calendar.tsx` | 2026-09-27 |
| `react-easy-crop` | `^6.2.3` | The crop widget behind the upload-time rotate-and-crop dialog (media-library (`431ed6e7:docs/specs/media-library/trd.md`) D6a): pinch-zoom, drag, wheel zoom and quarter-turn rotation on a touch screen are the interaction a hand-rolled crop gets wrong on a phone. It renders our picture and reports a rectangle; it stores nothing and touches no colour. Ships a stylesheet the component imports — without it the frame has no bounds and the picture does not show, which is how it first shipped | `src/components/product/crop-dialog.tsx` | 2026-09-27 |
| `@vercel/analytics` + `@vercel/speed-insights` | `^2.0.1` / `^2.0.0` | Page analytics and Core Web Vitals, mounted in `src/app/layout.tsx`. Both serve their script from our own origin, so the CSP needs no third-party `script-src` for them | `src/app/layout.tsx` | 2026-09-21 |
| `sonner` | `^2.0.7` | Toast notifications | `src/app/providers.tsx` | 2026-08-03 |
| `clsx` + `tailwind-merge` + `class-variance-authority` | — | The shadcn/ui `cn()` helper and variant definitions | `src/lib/utils.ts` | 2026-08-03 |

## Dev

| Package | Pinned | Why |
|---|---|---|
| `typescript` | `^5` | Type checking |
| `vitest` + `@vitest/coverage-v8` + `@vitest/ui` | `^4.0.16` | Test runner and coverage. See [TESTING.md](TESTING.md) |
| `happy-dom` | `^20.0.11` | DOM for component tests — lighter than jsdom |
| `@testing-library/react` + `jest-dom` | — | Component testing and matchers |
| `@vitejs/plugin-react` | `^5.1.2` | JSX transform for Vitest |
| `eslint` + `eslint-config-next` | `^9` / `16.4.3` | Linting. Gate policy in [TESTING.md](TESTING.md). `eslint-config-next` moves with `next`, exactly |
| `@playwright/test` | `1.63.0` | The browser journeys that gate a production deploy (`e2e/`, [GTM-READINESS](GTM-READINESS.md) B8). The de facto standard for Next.js; runs a real Chromium against a production build. Pinned exactly so the browser build CI installs matches the runner |
| `tailwindcss` + `@tailwindcss/postcss` | `^4` | Styling (Tailwind v4 via the PostCSS plugin) |
| `tw-animate-css` | `^1.4.0` | Animation utilities for shadcn |
| `dotenv` | `^17.2.3` | Loads `.env` for `prisma.config.ts` and scripts |
| `tsx` | `^4.23.15` | Runs `worker/main.ts` locally (`npm run worker`): ESM-native, follows the `@server/*` alias, and loads pg-boss, which is ESM-only |
| `ts-node` | `^10.9.2` | Runs `prisma/seed.ts` |
| `tsconfig-paths` | `^3.15.0` | Resolves the `@server/*` alias for that seed run. Was present transitively and relied on by accident until PR-125; the seed reaches aliased modules through `org.handle`, and without it `db seed` dies on the first one. Needs `baseUrl` in `tsconfig.json`, which is why that field exists. |
| `@types/*` | — | Type definitions |
| `vite` | `^7.3.0` | Not imported — declared to satisfy the `overrides` entry that pins Vitest's transitive copy onto one patched version |

## Removed

Kept rather than deleted, per the update rules above — a package that comes back should come
back with its history.

| Package | Removed | Why |
|---|---|---|
| `razorpay` | 2026-09-21 | The SDK was never imported: `server/payments/providers/razorpay/razorpay.repository.ts` calls the REST API with `fetch`, which this file had flagged since 2026-08-03. It was also the only thing pulling `axios`, whose prototype-pollution advisories left with it |
| `@vercel/blob` | 2026-09-21 | The retired image store, unreferenced once its migration script went (see `scripts/README.md`, which records why). Removing it also cleared the `undici` advisories. Images live in R2 ([ADR-0028](adr/0028-images-live-in-cloudflare-r2.md)) |
| `baseline-browser-mapping` | 2026-09-21 | A declared devDependency nothing referenced, and the only package with no row in this file — which is how it survived. Still present transitively under `browserslist`, so nothing changed but the declaration |

## Design system

Not a package, but a choice worth recording: shadcn/ui **New York** style on a neutral base, accented emerald and gold, with **Playfair Display** for display type and **DM Sans** for body. The stated design intent is a *daytime courtyard* aesthetic — the reason for the warm neutrals over a cooler default palette.

## Notable absences

Deliberate, or worth knowing:

- **No `decimal.js` / Prisma `Decimal`** — money will be integer paise instead ([ADR-0004](adr/0004-money-as-integer-paise.md)).
- **No date library.** Native `Date` only. Keep it that way unless a real formatting need appears.
- **No data-fetching library** (TanStack Query, SWR). Hand-rolled `src/hooks/core/useAsyncData.ts` and `useMutation.ts` instead. Reconsider if cache invalidation grows hairy.
- **No logger and no error tracking.** `console.log` throughout. A real gap for a store handling payments — Phase 5 in [BACKLOG.md](BACKLOG.md).
- **No `@t3-oss/env` or similar.** `src/lib/env.ts` hand-rolls the required-variable list.
