# ADR-0037: The host is a deployment fact, not an architectural input

- **Date:** 2026-09-25
- **Status:** Accepted

## Context

This store runs on Vercel's Hobby plan, and two facts collided on 2026-09-25. Hobby is licensed for non-commercial use and Vercel's fair-use guidelines name processing payment from visitors as commercial usage, which this store does ([INTEGRATIONS.md](../INTEGRATIONS.md)). Separately, the plan's limits had already begun shaping designs: a cron that cannot run more often than daily, a function that cannot run past five minutes, and a background worker being specified partly around what the platform would permit.

Those are two different problems and only one of them is urgent. Being on the wrong plan is a billing and licensing question with a known answer and a price. The more expensive problem is quieter: decisions were being taken *because of* a plan tier, which means the plan tier had become an input to the architecture. Once that happens, changing plan or changing host stops being a purchase and becomes a migration.

The store has done this well once already. [ADR-0028](0028-images-live-in-cloudflare-r2.md) moved image storage off Vercel Blob onto Cloudflare R2 behind a single seam, and the move was cheap precisely because the rest of the code had never learned where images lived. What is wanted is that property everywhere, stated as a rule rather than achieved by luck.

## Decision

1. **The application is written against standards, not against a host.** A platform-specific API, header or environment variable is reached only through a seam that declares what it needs in neutral terms, in the manner of `appUrl()` and the R2 object-store seam.
2. **Environment is named by the application.** Branch on an application-owned variable — not on `VERCEL_ENV`, and not on whether some vendor's variable happens to be present. Presence of a vendor variable describes where the code is running; it must never decide what the code does.
3. **A platform-specific value has a declared fallback and fails loudly.** The trusted-proxy header carrying a caller's address is configuration, not a literal. A host change that invalidates it must produce a refusal or an alarm, never a control that quietly stops working.
4. **Vendor names do not leak into configuration.** Environment variables are named for what they hold, not for the integration that provisioned them. `KV_REST_API_URL` is the standing counter-example and [OPERATIONS.md](../OPERATIONS.md) already calls it a trap.
5. **The plan tier may constrain operations; it may not constrain design.** Choosing a daily cron because the plan forbids hourly is acceptable and belongs in OPERATIONS.md. Designing a data model, a domain boundary or a control around a plan limit is not.
6. **Free tiers are used while they serve, and never depended upon.** A free tier is a commercial arrangement that can change; nothing may be correct only because a tier is currently generous.

## Alternatives considered

- **Use the platform's primitives fully — Vercel Cron, KV, WAF rate limiting, Blob, Analytics.** The conventional choice, and the one the platform is designed to reward: less code, less operational surface, one bill, and primitives that are genuinely good. Rejected because this store takes real money from real people and its owner intends it to outlive a pricing page. The 2026-09-25 licensing discovery is the concrete argument: an external commercial decision, made by someone else, would have forced an architectural response rather than a purchase.
- **Leave Vercel now for a host with no such restriction.** Rejected as premature and as the same mistake reversed. Choosing a host before the code is portable simply relocates the coupling. Make the move cheap first; then the decision can be taken on merit, reversibly, whenever it is actually wanted.
- **Abstract every platform dependency behind an interface immediately.** Rejected as speculative generality — the project's own YAGNI principle. Seams are added where a dependency is genuinely reached, as ADR-0028 did, not pre-built for hosts nobody has chosen.

## Consequences

✅ The host becomes a purchase rather than a project. Moving to Vercel Pro, or off Vercel entirely, is a configuration change and a redeploy.

✅ The licensing question can be settled on its own terms, at its own pace, without holding any feature hostage.

✅ Local development and continuous integration run the real code paths, because those paths no longer require a platform to exist — the same argument that put an Upstash-compatible proxy into CI rather than a second implementation ([rate-limiting](../specs/rate-limiting/) D1b).

⚠️ Slightly more code than using a primitive directly, and a seam is a place a bug can hide. The R2 seam is the fair precedent for how much: small, but not nothing.

⚠️ Some platform conveniences are given up or wrapped. Vercel's analytics and speed-insights packages are imported directly in `src/app/layout.tsx` today and are vendor-coupled; they are cheap to remove, and this ADR does not require removing them — it requires that nothing *depend* on them.

⚠️ Self-hosting Next.js needs a cache handler for the data cache to work the way the hosted platform provides it for free. This is a known cost of the rule, and it lands on [read-caching](../specs/read-caching/) whenever that work resumes.
