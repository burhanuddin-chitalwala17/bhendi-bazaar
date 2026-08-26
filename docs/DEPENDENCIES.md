# DEPENDENCIES.md — dependency registry

- **Verified:** 2026-08-03

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
| `next` | `16.0.10` | Framework: App Router, RSC, route handlers | Everything | 2026-08-03 |
| `react` / `react-dom` | `19.2.1` | UI runtime | Everything | 2026-08-03 |
| `@prisma/client` / `prisma` | `^7.1.0` | Type-safe DB access; migrations | `server/repositories/**` | 2026-08-03 |
| `@prisma/adapter-pg` + `pg` | `^7.1.0` / `^8.16.3` | Driver adapter — Prisma 7 reaches Postgres through `pg` | `src/lib/prisma.ts` | 2026-08-03 |
| `next-auth` | `^4.24.13` | Sessions, credentials + Google OAuth, JWT strategy | `src/lib/auth-config.ts` | 2026-08-03 |
| `@auth/prisma-adapter` | `^2.11.1` | Persists NextAuth `Account` / `Session` / `VerificationToken` | `src/lib/auth-config.ts` | 2026-08-03 |
| `bcryptjs` | `^3.0.3` | Password hashing. Cost 10 | `server/identity/password.service.ts` | 2026-08-03 |
| `razorpay` | `^2.9.5` | Payment gateway SDK. **Note:** `server/payments/providers/razorpay/razorpay.repository.ts` calls the REST API with `fetch` directly rather than using this SDK; one of the two should go | payments domain | 2026-08-03 |
| `zod` | `^4.2.1` | Runtime validation at the HTTP boundary — the mechanism behind [Invariant 4](../CLAUDE.md) | `src/lib/validation/**` | 2026-08-03 |
| `zustand` | `^5.0.9` | Cart state with localStorage persistence. Chosen for size and minimal boilerplate | `src/store/cartStore.ts` | 2026-08-03 |
| `@upstash/ratelimit` + `@upstash/redis` | `^2.0.7` / `^1.36.0` | Distributed rate limiting. Required because Vercel runs many instances, so in-memory counters do not hold. **Reads `KV_REST_API_*`, not `UPSTASH_REDIS_REST_*`** | `src/lib/rate-limit.ts` | 2026-08-03 |
| `@vercel/blob` | `^2.0.0` | Product and profile image storage | `api/admin/upload`, `api/profile/upload-picture` | 2026-08-03 |
| `exceljs` | `^4.4.0` | Reads and writes the bulk-upload sheets (.xlsx/.csv) and generates the per-org sample. Chosen over npm `xlsx`/SheetJS, whose free build is unmaintained with unfixed parser advisories — this parses user-supplied files | `server/catalog/bulk/**` | 2026-08-21 |
| `resend` | `^6.6.0` | Transactional email | `server/notifications/email.service.ts` | 2026-08-03 |
| `react-hook-form` + `@hookform/resolvers` | `^7.68.0` / `^5.2.2` | Admin form state with Zod resolvers | `src/components/shared/forms/**` | 2026-08-03 |
| `@radix-ui/*` | various | Accessible primitives behind shadcn/ui: dialog, separator, slot, switch | `src/components/ui/**` | 2026-08-03 |
| `lucide-react` | `^0.561.0` | Icons | Throughout UI | 2026-08-03 |
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
| `eslint` + `eslint-config-next` | `^9` / `16.0.10` | Linting. Gate policy in [TESTING.md](TESTING.md) |
| `tailwindcss` + `@tailwindcss/postcss` | `^4` | Styling (Tailwind v4 via the PostCSS plugin) |
| `tw-animate-css` | `^1.4.0` | Animation utilities for shadcn |
| `dotenv` | `^17.2.3` | Loads `.env` for `prisma.config.ts` and scripts |
| `ts-node` | `^10.9.2` | Runs `prisma/seed.ts` |
| `@types/*` | — | Type definitions |

## Design system

Not a package, but a choice worth recording: shadcn/ui **New York** style on a neutral base, accented emerald and gold, with **Playfair Display** for display type and **DM Sans** for body. The stated design intent is a *daytime courtyard* aesthetic — the reason for the warm neutrals over a cooler default palette.

## Removed
*(none yet — record removals here rather than deleting rows)*

## Notable absences

Deliberate, or worth knowing:

- **No `decimal.js` / Prisma `Decimal`** — money will be integer paise instead ([ADR-0004](adr/0004-money-as-integer-paise.md)).
- **No date library.** Native `Date` only. Keep it that way unless a real formatting need appears.
- **No data-fetching library** (TanStack Query, SWR). Hand-rolled `src/hooks/core/useAsyncData.ts` and `useMutation.ts` instead. Reconsider if cache invalidation grows hairy.
- **No logger and no error tracking.** `console.log` throughout. A real gap for a store handling payments — Phase 5 in [BACKLOG.md](BACKLOG.md).
- **No `@t3-oss/env` or similar.** `src/lib/env.ts` hand-rolls the required-variable list.
