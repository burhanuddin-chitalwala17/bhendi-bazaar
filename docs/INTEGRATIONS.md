# INTEGRATIONS.md — external-service behaviour

- **Verified:** 2026-08-13

## Purpose
What the services we depend on actually do — the behaviour that is not derivable from our code and not obvious from their documentation. Payment, courier, and platform quirks belong to no single domain and outlive any one call site, so they live here rather than in a comment.

**This is not a list of our defects.** It records how someone else's system behaves. When something here explains a constraint on our design, it is cited from the relevant ADR or spec.

**Add to it whenever a spike or an incident teaches something durable.** An entry that saves one hour of rediscovery has paid for itself. Mark anything unverified as such rather than stating it confidently — a wrong entry here is worse than a missing one, because it will be trusted.

---

## Razorpay (payments)

**The `notes` round-trip is a string contract the compiler cannot check.** Our order id
travels to Razorpay in `notes` at gateway-order creation and comes back in every
payment webhook. The key is `RAZORPAY_NOTES_ORDER_KEY` (`server/payments/notes.ts`),
used by both sides and pinned by a test — because creation once wrote `orderId` while
the webhook read `localOrderId`, and every webhook silently no-op'd while returning
200. Razorpay also caps `notes` at 15 keys / 256 chars per value.

- **Amounts are integer paise.** `₹499.50` is `49950`. This is a large part of why we store money the same way ([ADR-0004](adr/0004-money-as-integer-paise.md)) — the boundary already wants integers, so converting late was losing precision for nothing.
- **`notes` is a free-form key-value bag** attached at order creation and echoed back on webhook payloads. It is the mechanism for correlating a gateway payment to our order — and it is a **string-keyed contract that no compiler checks**. The key written at creation and the key read at webhook time must match exactly; there is no error if they do not, because a missing key is simply `undefined`. Assert the round trip in a test ([payment-confirmation](specs/payment-confirmation/) D6).
- **Two different signatures, computed differently:**
  - *Client-return verification* — HMAC-SHA256 over `<gateway_order_id>|<payment_id>` with the **key secret**.
  - *Webhook verification* — HMAC-SHA256 over the **raw request body** with the **webhook secret** (a separate value from the key secret). The body must be verified *before* parsing; parsing and re-serialising changes the bytes and the signature will not match.
- **A signature attests that a payment occurred against a gateway order.** It says nothing about the amount matching *our* order's total. The amount check is a separate, mandatory step ([ADR-0002](adr/0002-server-holds-pricing-authority.md)).
- **Webhooks retry on non-2xx**, which is what makes failing loudly safe — but only if the handler is idempotent, or a retry duplicates side effects.
- **Test vs live keys are distinguishable by prefix** (`rzp_test_` / `rzp_live_`). Worth asserting in a startup check: a test key in production fails silently in the sense that nothing errors, it just never takes money.
- **The dashboard's webhook delivery log** records every attempt and our response. It is the first place to look when a confirmation did not arrive — before reading our own logs.
- Test card `4111 1111 1111 1111` works in test mode.

## Shiprocket (courier)

- **Auth is a bearer token with an expiry**, obtained by posting email and password. It is not a long-lived API key, so the token must be cached, its expiry tracked, and re-authentication handled — a 401 mid-session is normal operation, not an error condition. This is why credentials rather than a key are stored ([shipping ADR-0002](../server/shipping/adr/0002-credentials-via-admin-not-env.md)).
- **Rate requests are priced on weight** in kilograms, with origin and destination pincodes. Serviceability is per-pincode-pair, so a rate response can legitimately be empty rather than an error.
- **Status vocabulary is theirs and is finer-grained than ours**, and they can add to it. Normalised on entry ([shipping ADR-0003](../server/shipping/adr/0003-normalise-carrier-status-on-entry.md)).
- **Webhooks carry no signature by default.** ⚠️ *Unverified* — confirm current options in their dashboard before relying on this. If no signature is available, a shared-secret header or a hard-to-guess path is the fallback, and the handler must still fail loudly on an unmatched payload.
- **Rate lookups are slow and rate-limited**, which is why quotes are cached (`ShippingRateCache`).
- **Booking and rate quoting are separate calls.** A rate quote is not a reservation — the price can change between quoting and booking, which is the source of [shipping-fulfilment](specs/shipping-fulfilment/) Q2.

## Resend (email)

- **`onboarding@resend.dev` sends without domain verification**, which is what makes local development work with no DNS setup. It cannot be used in production.
- **A production sending domain needs SPF, DKIM, and DMARC records.** Without them mail is accepted by Resend and then filtered by the recipient — so a "successful" send is not a delivered email. This is the most common cause of "the confirmation email didn't arrive".
- **Sending is a network call that can be slow.** ⚠️ Awaiting it inside a request handler makes response latency depend on it; where that latency differs between two code paths, it becomes observable. Prefer dispatching outside the response path.

## Vercel (platform)

- **Serverless request bodies are capped at roughly 4.5 MB.** Our upload validation permits 5 MB, so a file between the two limits is rejected by the platform rather than by our handler, producing a less useful error. Worth aligning.
- **No state survives between requests.** Any in-memory counter, cache, or rate limiter is per-instance and resets on cold start — which is why rate limiting uses Redis ([ADR-0001](adr/0001-monorepo-doc-structure.md) is not the reason; the reason is here).
- **Each warm instance holds its own database connections.** With default pool sizing, a modest number of concurrent instances can exhaust Postgres `max_connections`. Use a pooled connection string in production.
- **Environment variables are per-environment** and require a redeploy to take effect. `vercel env pull` brings them locally.
- **Upstash provisioned through Vercel's integration is named `KV_REST_API_URL` / `KV_REST_API_TOKEN`** — *not* the `UPSTASH_REDIS_REST_*` names in Upstash's own documentation. See [OPERATIONS.md](OPERATIONS.md) for why this specific mismatch is unusually costly.

## Vercel Blob (storage)

- **`addRandomSuffix` controls whether an upload can overwrite an existing path.** With it disabled, a caller who controls the filename controls the stored path, and a predictable path can be overwritten.
- **Allowed hostnames must be listed in `next.config.ts`** under `images.remotePatterns`, or `next/image` refuses to render them.
- The store's blob hostname is configured there.

## YouTube (product video)

Embedding only — nothing is uploaded and no video file is ever served by us ([ADR-0017](adr/0017-video-is-embedded-not-hosted.md)).

- **No OAuth and no API key are needed to embed.** An embed is an iframe against a video id. Credentials would only be required to upload on someone's behalf or read private metadata, and we do neither.
- **The uploader can disable embedding, and there is no way to detect that before rendering.** The link stays valid, the poster still loads, and the iframe shows YouTube's own error. This is why the unavailable state is a rendering concern rather than a validation rule.
- **A video we do not own can be deleted, made private, or age-restricted at any moment.** A failed poster is the only signal available cheaply, so it is what drives the unavailable state.
- **A monetised third-party video runs its owner's advertising inside our page.** Accepted knowingly; see the ADR's consequences.
- **`maxresdefault.jpg` 404s for any video never published above 720p.** `hqdefault.jpg` always exists, so that is the poster size used. Both live on `i.ytimg.com`, which must be listed in `next.config.ts` under `images.remotePatterns` or `next/image` refuses to render them.
- **oEmbed (`https://www.youtube.com/oembed?url=...&format=json`) needs no key** and 404s for a video that does not exist or is private. Available for save-time validation; not currently called — the boundary only parses the link shape.
- **Embeds use `youtube-nocookie.com`**, and the player is mounted on a tap rather than on load.

## Google OAuth

- **The redirect URI must match exactly**, including scheme, host, port, and path: `<NEXTAUTH_URL>/api/auth/callback/google`. A mismatch fails at Google with a message that does not name the expected value.
- **A separate redirect URI is needed per environment.** Local, preview, and production are three entries.
- **NextAuth v4 does not link a Google login to an existing email-matched account by default** under a JWT session strategy — the adapter's linking behaviour does not apply. `src/lib/auth-config.ts` does it explicitly in its `signIn` callback. This is the least obvious behaviour in our auth setup and the easiest to break by "simplifying" that callback.
- **NextAuth v4's default session token is an encrypted JWE**, not a signed HS256 JWT. Anything asserting otherwise is wrong.

## Prisma 7

- **The seed command lives in `prisma.config.ts`** (`migrations.seed`), not in `package.json`'s `prisma.seed` key as in earlier versions. A missing `package.json` key does not mean seeding is unconfigured.
- **A driver adapter is required.** Constructing `new PrismaClient()` with no adapter and no datasource `url` throws. Any standalone script must build the client the way `src/lib/prisma.ts` does.
- **Default transaction isolation is READ COMMITTED with no row locking**, so a read followed by a write inside `$transaction` does not prevent concurrent callers from both passing the read ([ADR-0007](adr/0007-conditional-stock-decrement.md)).
- **`contains` compiles to `LIKE '%term%'`.** A leading wildcard cannot use a btree index, so no amount of indexing makes the current product search fast — it needs `pg_trgm` or a `tsvector` column.
- **A column-to-column comparison** (for example `stock <= lowStockThreshold`) is not expressible in the Prisma query API and needs raw SQL.
