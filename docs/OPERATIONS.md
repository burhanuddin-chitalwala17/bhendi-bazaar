# OPERATIONS.md — setup, env, deploy, runbook

- **Verified:** 2026-08-09

## Prerequisites
Node 20.x (CI pins `20.x`) · PostgreSQL 14+ · npm · a Razorpay account (test mode for development).

## First-time setup

```bash
npm install                 # postinstall runs `prisma generate`
touch .env                  # build it from the table below — there is no .env.example
npx prisma migrate dev      # apply the migrations
npm run dev                 # http://localhost:3000
```

⚠️ **Do not run `npx prisma db seed` casually.** It deletes every table. See [Seeding](#seeding).

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres connection string |
| `NEXTAUTH_SECRET` | ✅ | JWT signing key. Generate: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | ✅ | Canonical app URL. `http://localhost:3000` locally; the deployed origin in production |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth. Redirect URI: `<NEXTAUTH_URL>/api/auth/callback/google` |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | ✅ | Payment gateway. `rzp_test_*` for development |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | ✅ | The same key **id**, exposed to the browser checkout widget. Never expose the secret |
| `RAZORPAY_WEBHOOK_SECRET` | ✅ | Verifies webhook signatures. Without it the webhook fails closed |
| `CRON_SECRET` | ✅ | Bearer token Vercel Cron sends to `/api/cron/reconcile-payments` (the missed-webhook backstop, every 15 min per `vercel.json`). Any long random string; set it in Vercel env |
| `BLOB_READ_WRITE_TOKEN` | ✅ | Vercel Blob, for product and profile images |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | ✅ | Upstash Redis for rate limiting — see the naming trap below |
| `ENCRYPTION_KEY` | ✅ | AES-256-GCM key for stored shipping credentials. Use 32 bytes of hex |
| `RESEND_API_KEY` / `EMAIL_FROM` | ✅ | Transactional email |
| `SHIPROCKET_EMAIL` / `SHIPROCKET_PASSWORD` | ○ | Only if connecting Shiprocket by env rather than through the admin UI |
| `NEXT_PUBLIC_APP_URL` | ✅ | The app's public origin. **Every outbound link is built from it** — verification, password reset, order tracking (`server/shared/app-url.ts`, `appUrl()`). Unset and email sends throw rather than mailing `undefined/...` |
| `NEXT_PUBLIC_ASSETS_URL` | ○ | Base URL for blob-hosted assets |
| `SEED_ALLOW_DESTRUCTIVE` | ○ | Set to `1` to let `prisma/seed.ts` wipe and reseed. **Never set in a deployment environment** |
| `SEED_ALLOWED_DATABASE_URL` | ○ | The exact development connection string. Required to seed any non-localhost database — see below. **Never set in a deployment environment** |

`src/lib/env.ts` holds the required-variable list. Note it does not currently include `ENCRYPTION_KEY` or `RAZORPAY_WEBHOOK_SECRET`, so add those to any check you rely on.

### Local development database
Development runs against a local Postgres, never a metered cloud one — a hot-reload session against Prisma Postgres is what exhausted the workspace's operation quota in August 2026 (CHANGELOG PR-70). One-time setup:

```
createdb bhendi_bazaar_dev
# .env
DATABASE_URL="postgres://<your-user>@localhost:5432/bhendi_bazaar_dev"
npx prisma migrate deploy
SEED_ALLOW_DESTRUCTIVE=1 npx prisma db seed
```

`PRISMA_LOG_QUERIES=1` makes the Prisma client print every SQL statement — the instrument behind `scripts/measure-db-ops.sh`, which counts billed operations per storefront page. Dev-only; never set in a deployment.

### ⚠️ Seeding
`prisma/seed.ts` deletes every table, so it refuses to run unless the target is named (Invariant 7). Wiping is its own gate:

```
SEED_ALLOW_DESTRUCTIVE=1
```

On localhost, only the database **named** `bhendi_bazaar_dev` may be seeded — a local hostname alone proves nothing when the same server hosts unrelated work databases. For a cloud development database, name the exact connection string as well:

```
SEED_ALLOWED_DATABASE_URL=<the exact same string as your dev DATABASE_URL>
```

`SEED_ALLOWED_DATABASE_URL` exists because **hostname cannot tell dev from production here** — Prisma Postgres serves both from `db.prisma.io`, so allowing the host would allow production. Matching the full connection string identifies one specific database. Keep these variables in your local `.env` only; production stays protected precisely by never having them.

To seed reference data that production also needs, do not reach for the seed — write a data migration. `vercel.json` runs `prisma migrate deploy` before the build, so a migration reaches every environment on merge, while the seed reaches none of them.

### Cleaning up old catalogue images
`scripts/cleanup-flat-blobs.ts` removes pre-2026-08 flat-layout product images from Blob once a catalogue has been re-onboarded through bulk upload. Two intents, like the seed:

```
npx tsx scripts/cleanup-flat-blobs.ts                              # dry-run, lists what would go
CLEANUP_ALLOW_DELETE=1 npx tsx scripts/cleanup-flat-blobs.ts --delete
```

The keep-set is every `ProductMedia.ref` and `Product.thumbnail` **in the database `DATABASE_URL` currently names**. The Blob store is shared across environments, so run the deletion only when that database is the one those images serve — the script prints the host it read for exactly this reason.

### ⚠️ The Upstash naming trap
The rate limiter reads **`KV_REST_API_URL`** and **`KV_REST_API_TOKEN`** — the names Vercel's Upstash integration provisions. Upstash's own dashboard calls them `UPSTASH_REDIS_REST_URL` / `_TOKEN`, and using those names produces **two different failures from the same missing config**: `src/lib/rate-limit.ts` asserts non-null at module load, so `signup` and `forgot-password` throw at import (fail closed), while `src/middleware.ts` catches the absence and disables limiting with only a logged warning (fail open). Use the names in the table.

### Two origin variables, two jobs
`NEXTAUTH_URL` is **NextAuth's own** configuration — it builds OAuth callback URLs and nothing else should read it. `NEXT_PUBLIC_APP_URL` is the app's public origin, used for links that leave the server. They hold the same value locally and *must* diverge on Vercel previews, so keep the responsibilities separate.

**The dev port is pinned:** `npm run dev` runs `next dev -p 3000`. This is deliberate. Google OAuth matches the registered redirect URI exactly (`http://localhost:3000/api/auth/callback/google`), so the port is a contract with an external service, not a preference. Unpinned, `next dev` silently falls back to 3001 when 3000 is busy — the app then serves from one port while both origin variables claim another, which breaks OAuth *and* puts the wrong host into every verification and reset email sent that session. Pinned, it fails loudly instead.

**Vercel previews:** preview deployments get dynamic origins, so a fixed `NEXTAUTH_URL` cannot match and OAuth will fail there. NextAuth v4 does not infer it — derive it from `VERCEL_URL` when `VERCEL_ENV === "preview"`. (NextAuth v5 removes the variable entirely, inferring the origin from request headers.)

### Local webhook testing (tunnel)
Gateway and courier webhooks need a publicly reachable URL, so local testing needs a tunnel:

```bash
cloudflared tunnel --url http://localhost:3000     # or: ngrok http 3000
```

Then, for the duration of that session:

1. Set **both** `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` to the tunnel origin. Leaving them on `localhost:3000` means OAuth callbacks and emailed links resolve to a host the outside world cannot reach.
2. Add `<tunnel>/api/auth/callback/google` to the Google Cloud Console redirect URIs, or Google sign-in fails with a mismatch error that does not name the expected value.
3. Point the gateway webhook at `<tunnel>/api/webhooks/razorpay` and the courier webhook at `<tunnel>/api/webhooks/shipping/shiprocket`.
4. Restart the dev server — `NEXT_PUBLIC_*` values are inlined at build time, so a change is not picked up by a running server.

Tunnel URLs are ephemeral on free tiers; each restart means repeating steps 1–3. Revert `.env` afterwards, or the next non-tunnelled run mails links to a dead host.

### Env hygiene
`.env*` is gitignored and has never been committed — keep it that way. Set `NODE_ENV` to a valid Node value (`development` / `production` / `test`); anything else silently changes behaviour in code that branches on it. Avoid keeping more than one live connection string in the file at a time — see [Seeding](#seeding) for why.

## Local PostgreSQL via Docker

```bash
docker run --name bhendi-pg -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=bhendi_bazaar -p 5432:5432 -d postgres:16
pg_isready -h localhost
```
Then `DATABASE_URL="postgresql://postgres:password@localhost:5432/bhendi_bazaar?schema=public"`.

## Everyday commands

```bash
npm run dev            # dev server
npm run build          # production build
npm start              # serve the build
npx tsc --noEmit       # typecheck
npm run lint           # ESLint
npm run test:run       # tests (single run)
npx prisma studio      # database GUI
npx prisma migrate dev # create + apply a migration
```

## Seeding

`prisma/seed.ts` begins by deleting every table, and `prisma.config.ts` wires it to `DATABASE_URL` from `.env` (Prisma 7 reads the seed command from `prisma.config.ts`, not `package.json`).

**Read `DATABASE_URL` and confirm it points at localhost before every seed.** The guard described in [Invariant 7](../CLAUDE.md) makes this automatic; until it is in place, the check is manual and there is no undo. Seeded credentials are defined in `prisma/seed/users.seed.ts` — never use them anywhere reachable from the internet.

## Creating an admin user

`npx prisma studio`, open `User`, and set `role: "ADMIN"` and `isEmailVerified: true` on an account created through normal sign-up, so the password hash is generated by the app rather than by hand.

## Connecting a shipping provider

1. Go to `/admin/shipping/providers`.
2. Each card shows connection state, priority, supported modes, and coverage.
3. Connect with provider credentials — stored AES-256-GCM encrypted.
4. Only configured providers can be enabled; changes take effect immediately.

This makes **rate quoting** live. Shipment booking currently uses a mock implementation — see [ARCHITECTURE.md](ARCHITECTURE.md) and [shipping-fulfilment](specs/shipping-fulfilment/).

## Infrastructure

Who owns what. Verified 2026-08-05 from `.vercel/project.json`, `.env`, and which variables the code actually reads.

| Concern | Provider | Notes |
|---|---|---|
| Hosting | **Vercel** | Project `bhendi-bazaar`; deploys from `main` |
| Domain | **GoDaddy** (registrar) | `bhendi-bazaar.com`; DNS points at Vercel |
| Database | **Prisma Postgres** (`db.prisma.io`) | Provisioned through the Vercel marketplace integration. **Not** Vercel Postgres/Neon — a different dashboard, different connection limits, and its own backup story |
| Connection pooling | **Prisma Accelerate** — provisioned, **not in use** | See below |
| Redis (rate limiting) | **Upstash** | Via the Vercel integration, hence the `KV_REST_API_*` names rather than Upstash's own `UPSTASH_REDIS_REST_*` |
| File storage | **Vercel Blob** | `BLOB_READ_WRITE_TOKEN`; hostname allow-listed in `next.config.ts` |
| Payments | **Razorpay** | Test keys locally (`rzp_test_*`) |
| Email | **Resend** | |
| Shipping | **Shiprocket** | Rates live; booking see [ARCHITECTURE.md](ARCHITECTURE.md) |
| OAuth | **Google Cloud** | Redirect URI per environment |

### Accelerate is provisioned but bypassed
`PRISMA_DATABASE_URL` holds a `prisma+postgres://accelerate.prisma-data.net/…` URL, but **nothing reads it** — `src/lib/prisma.ts`'s replacement, `server/shared/prisma.ts`, connects via `DATABASE_URL` directly. Accelerate exists to pool connections and cache queries, which is exactly the pressure a serverless deployment puts on a single Postgres instance. Worth revisiting: routing through it would address per-instance connection limits more thoroughly than tuning `max` on the local pool.

### Unused environment variables
The code reads only `DATABASE_URL` and `KV_REST_API_URL` from the connection-string set. `POSTGRES_URL`, `DB_URL`, `REDIS_URL`, `KV_URL`, and `PRISMA_DATABASE_URL` are read by nothing — leftovers from provisioning. Keeping several live connection strings in one `.env` is the hazard behind the seed guard ([Invariant 7](../CLAUDE.md)); prune them.

## Deploy

Vercel, project `bhendi-bazaar`, from `main`. All routes are server-rendered on demand.

- **Set every variable above in Vercel per environment.** `NEXTAUTH_URL` must be the deployed origin.
- `vercel env pull` before running migrations locally against a deployed database.
- **Migrations run in the build** ([ADR-0014](adr/0014-deploys-run-their-own-migrations.md)): `vercel.json`'s `buildCommand` is `npx prisma migrate deploy && next build`, so every Vercel build applies pending migrations to that environment's `DATABASE_URL` before compiling. A merge to `main` **is** a prod schema change; preview builds migrate whatever database the Preview environment points at. `migrate deploy` only applies pending migrations in order — never resets or drops. Manual `migrate deploy` remains only for local runs against a deployed database (`vercel env pull` first).
- Register the Razorpay webhook at `<origin>/api/webhooks/razorpay` and the Shiprocket webhook at `<origin>/api/webhooks/shipping/shiprocket`. Local webhook testing needs a tunnel.
- Use a pooled connection string (pgbouncer / Neon) in production: `src/lib/prisma.ts` creates a `pg` Pool per module evaluation with default sizing, so many warm instances can exhaust `max_connections`.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Can't reach database server` | Postgres not running (`pg_isready`), or a malformed `DATABASE_URL`. For Docker, check the container is up |
| `@prisma/client did not initialize yet` | `npx prisma generate` |
| `PrismaClientOptions` error in a script | Prisma 7 needs the `pg` adapter — construct the client the way `src/lib/prisma.ts` does, not bare |
| Port 3000 in use | `lsof -ti:3000 \| xargs kill` or `npm run dev -- -p 3001` |
| Rate limiting not applying | `KV_REST_API_*` missing or misnamed — see the naming trap above. Since PR-55 the limiter fails open with a one-time console warning rather than throwing; check the logs for `[rate-limit]`. The [rate-limiting](specs/rate-limiting/) spec closes this properly |
| Stale types or unexplained build errors | `rm -rf .next && npx prisma generate` |
| Webhook not arriving locally | No tunnel, or the secret is unset. Check the gateway dashboard's delivery log first — it records attempts and responses |
