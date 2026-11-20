# ADR-0028: Images live in Cloudflare R2, reached through one seam

- **Date:** 2026-09-17
- **Status:** Accepted (D6 historical — Blob is gone; the confirm-time check is [media-library](../specs/media-library/) D2; resizing by the optimizer replaced by stored widths, [ADR-0075](0075-photographs-are-stored-at-each-delivery-width-and-served-without-an-optimizer.md))
- **Context:** The free Vercel Blob allowance was exhausted pre-launch and the store was blocked — every content read returning `403 Your store is blocked`, including our own, which made exporting the data impossible ([ADR-0026](0026-images-are-delivered-through-the-optimizer.md) has the cause). The delivery and storage fixes in ADR-0026/0027 were necessary and are not in question. What they could not fix is the shape of the allowance itself.

  Measured against what this catalogue actually does, Vercel Blob's Hobby tier is the wrong instrument. 321 objects, 653 MB, built over twelve days:

  | | Vercel Blob (Hobby) | Cloudflare R2 (free) |
  |---|---|---|
  | Storage | 1 GB | 10 GB |
  | Egress | 10 GB, then **access withdrawn** | Free, unmetered |
  | Write operations | 2,000/month | 1,000,000/month |
  | Read operations | 10,000/month | 10,000,000/month |

  The operations limit is the one that fits worst. Transfer and storage scale with traffic and catalogue size, both now under control; advanced operations scale with how much you *work on* the catalogue — and dashboard browsing counts. A shop in its build-out phase spends operations exactly when it has the least revenue to pay for them. 2,000 a month is two bulk uploads.

  R2 removes the meter that broke us rather than raising it: there is no egress charge on any storage class, so the failure mode that blanked the catalogue cannot recur. This was also the moment the change was nearly free — 321 images were going to be re-uploaded from local originals anyway, since the old store could not be read.
- **Decision:**
  1. **Images live in Cloudflare R2, spoken to over the S3 API.** Hosting stays on Vercel: nothing that happened was a hosting failure, and the architecture is Vercel-shaped (cron in `vercel.json`, migrations on deploy per [ADR-0014](0014-deploys-run-their-own-migrations.md), and a deliberate dependency on the image optimizer per ADR-0026).
  2. **One seam: `server/catalog/object-store.ts`.** Every write, delete and URL derivation goes through it. The move off Vercel Blob touched ten files precisely because "where images live" was spread across two upload routes, two bulk wizards, a profile handler and three scripts; the next such move should touch one.
  3. **Reads never pass through our code.** An object is public and fetched directly from `R2_PUBLIC_BASE_URL` by the browser or the optimizer. Proxying reads through a function would reintroduce a metered egress path, which is the thing being escaped.
  4. **The public base URL is configuration, never derived.** `R2_PUBLIC_BASE_URL` is `r2.dev` in development and a custom domain in production — Cloudflare rate-limits `r2.dev` and says not to use it in production. It is deliberately not derived from `R2_ENDPOINT`, which is the credentialed S3 host and not public. `next.config.ts` reads it for `remotePatterns`, because a host missing there 404s every image at the optimizer with no error anywhere.
  5. **A browser gets a presigned PUT, not a bearer token.** The path and `content-type` are signed, so neither can change after approval. The request shape is validated by a Zod schema like any other body (Invariant 4).
  6. **The old Vercel Blob host stays in `remotePatterns` until the migration is verified**, so a partially repointed catalogue still renders. `@vercel/blob` is retained only by the three scripts whose job is to empty the old store.
  7. **Objects are written `immutable, max-age=31536000`.** Every pathname carries a timestamp or a random suffix, so an object's bytes never change and there is no invalidation story to get wrong.
- **Alternatives considered:**
  - *Vercel Pro at $20/month* — the obvious answer, and it does end this class of problem: Pro bills overage instead of withdrawing access. Rejected because the owner declined it, and because on the merits it pays a platform fee to make a badly-shaped free tier bigger rather than fixing the shape. R2's free tier is larger than Pro's *included* Blob usage on every axis that matters here, at no cost.
  - *A different Vercel Blob store* — the original plan. Rejected on Vercel's own documentation: storage, operations and transfer "aren't affected by how many stores you create", because the included usage belongs to the plan. A second store in the same account shares the exhausted allowance.
  - *Prisma Object Store* — genuinely attractive, since Prisma Postgres is already in the stack and it would mean one console and one set of credentials. Rejected because its docs state that "bucket pricing and plan limits are not published yet". Having just been blocked by a limit that was not being watched, adopting a store whose limits cannot be read is the same mistake with better branding. Worth revisiting once they publish.
  - *Supabase Storage* — real and solid, but a tenth of R2's storage, metered egress, and it introduces a second platform without replacing the first.
  - *AWS S3 + CloudFront* — the most serious alternative, and closer than it first appears: CloudFront's free tier is **1 TB of egress per month with no 12-month limit**, which would have absorbed even the pre-fix 55 GB, and at this catalogue's size the post-trial cost is around a rupee a month. Rejected on risk shape rather than economics. It is three services to wire correctly — S3, CloudFront, and an Origin Access Control policy — against R2's one, with three places for a public-bucket mistake; S3's 5 GB storage allowance expires after twelve months where R2's 10 GB does not; and it **requires a payment method with no spending cap by default**. For an owner who has just declined a $20/month plan, an unbounded bill from a misconfiguration is a worse failure than the capped one being escaped. Worth revisiting if AWS is ever adopted for other reasons, with billing alarms as a precondition.
  - *Google Cloud Storage* — ruled out rather than weighed. Its always-free storage is smaller, restricted to US regions (the wrong latency for Indian buyers), and egress is metered, which is the meter that caused this.
  - *Images as `bytea` in Postgres* — rejected. No CDN, and it loads the database that [was already identified](../OPERATIONS.md) as the next ceiling. Prisma publish a recommendation against it.
  - *Moving hosting as well — Hetzner, Railway, Render* — rejected. It costs money and a week to re-solve deploys, SSL, cron and image optimization, and addresses nothing that actually broke.
  - *`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`* — the conventional S3 client. Rejected for weight: two packages and several megabytes in a serverless function, to issue PUT, DELETE and a presigned URL. `aws4fetch` is one small file and covers all three.
- **Consequences:**
  - ✅ The meter that blanked the catalogue no longer exists. R2 charges nothing for egress on any storage class, so image traffic cannot withdraw access.
  - ✅ 10× the storage and 500× the write operations, free. The re-encoded catalogue (~80 MB) sits under 1% of the storage allowance.
  - ✅ "Where images live" is one module. The next such migration is a day, not ten files.
  - ⚠️ **The declared upload size is validated but not signed.** `Content-Length` is a forbidden header, so the Fetch `Request` constructor strips it and it cannot be bound into a presigned PUT; S3 PUT has no equivalent of a POST policy's `content-length-range`. An authenticated admin or org member who bypasses our client could therefore write an object larger than `MAX_IMAGE_BYTES`. The bound is authentication, not cryptography. `tests/unit/object-store.test.ts` pins this so it is not misread as enforced. If it ever needs to be real, the bulk-create route already receives every uploaded URL and could `head()` and reject.
  - ⚠️ **A custom domain requires the domain to be a Cloudflare zone.** The registrar can stay GoDaddy, but nameservers move to Cloudflare. Until then `r2.dev` works and is rate-limited.
  - ⚠️ Cloudflare is a new vendor in the stack, with its own dashboard, credentials and failure modes. This is the real cost of the decision, accepted because the alternative was a store that can switch itself off.
  - ⚠️ R2 has no image optimizer of its own. This is fine because `next/image` on Vercel optimizes from any remote host, but it does mean the optimizer and the origin are now on different platforms, and ADR-0026's transformation quota is the remaining shared meter.
