# ADR-0035: Every response carries a nonce-based Content-Security-Policy

- **Date:** 2026-09-21
- **Status:** Accepted

> Recorded retroactively on 2026-09-23. The decision shipped in PR-117 and was written into
> [CLAUDE.md](../../CLAUDE.md)'s conventions index without an ADR to point at — which is the
> thing the conventions index is for. [ADR-0009](0009-docs-reference-code-never-copy-it.md)
> D6 says a rule has exactly one wording; without this file, that wording had nowhere to live
> but the always-loaded rules file.

## Context

The application sent no security response headers at all: no CSP, no HSTS, no
`X-Frame-Options`, no `Referrer-Policy`, no `Permissions-Policy`. `next.config.ts` set a
conditional `X-Robots-Tag` and nothing else.

The trigger was a question about whether payments could be faked from the browser. Tracing it
established that they could not: the charged amount is read from the persisted order and
`createPaymentOrderSchema` has no `amount` field
([ADR-0002](0002-server-holds-pricing-authority.md)); the paid transition requires an HMAC
over `order_id|payment_id` that needs the gateway key secret, compared with `timingSafeEqual`;
and a signature from one order is refused against another because the persisted
`gatewayOrderId` must match ([ADR-0005](0005-payment-state-server-only.md)). None of that is
reachable from a browser.

What *was* reachable was everything around the payment — the session, the address book, the
basket — because nothing stopped a script from running on our origin if one ever got there.
The exposure was never "forge a confirmation"; it was "execute anything at all."

## Decision

1. **A per-request nonce.** `src/middleware.ts` mints one and sets it on both the request (so
   Next stamps it onto the inline scripts it renders) and the response.
2. **`script-src` never contains `'unsafe-inline'`.** That single token makes the whole policy
   decoration while leaving the header present and reassuring, which is worse than no header.
3. **`'unsafe-eval'` is development-only** — React's dev build compiles with eval; the
   production build does not, and shipping the exception hands an attacker a string-to-code
   primitive.
4. **No `strict-dynamic`.** It discards the host allowlist in supporting browsers, and
   Razorpay's checkout script is appended at runtime by
   `src/services/paymentGatewayService.ts` rather than rendered with a nonce. An explicit
   allowlist covers that and fails visibly.
5. **The gateway is admitted by name on every channel its checkout uses** — `script-src`,
   `frame-src`, `form-action`, `connect-src`. Missing one fails as what looks like a gateway
   outage.
6. **The invariant headers live in `next.config.ts`** (HSTS, `nosniff`, `X-Frame-Options`,
   `Referrer-Policy`, `Permissions-Policy`) so they reach static assets, which never run
   middleware.
7. **`CSP_REPORT_ONLY=1` downgrades enforcement to reporting** without a code change or a
   rebuild — the escape hatch when a policy change breaks a page in production, not a place to
   leave things.
8. **`tests/unit/security-headers.test.ts` asserts the properties, not the string**, so the
   policy can be edited but not defanged.

## Alternatives considered

- **`'unsafe-inline'` with a host allowlist.** The common shipping configuration, and the one
  that does nothing: an injected inline `<script>` executes. Rejected outright.
- **Report-only until proven.** Tempting for a live store, and rejected as the default because
  a report-only policy enforces nothing and tends to stay that way. Kept as the env-var escape
  hatch instead, so the safe state is the default and the unsafe one is deliberate.
- **`strict-dynamic` with a nonce.** Stronger in principle and the modern recommendation.
  Rejected here because the runtime-appended gateway script and the analytics scripts made the
  failure mode "payments silently stop working," which is worse than a slightly weaker policy.
- **Headers in `next.config.ts` only.** Simpler, and cannot express a per-request nonce — which
  is the entire point.

## Consequences

- ✅ An injected script does not execute; the class of attack the question was about is closed.
- ✅ Clickjacking of the admin console and checkout is refused by `frame-ancestors 'none'`.
- ⚠️ Middleware now runs on every document request rather than only the two portals. Accepted:
  every route is already server-rendered on demand, so nothing became dynamic that was not.
- ⚠️ A new third-party script needs a policy edit, and will fail silently in the browser
  console until it gets one. That is the cost of the policy working.
- ⚠️ `style-src` keeps `'unsafe-inline'` — Next inlines critical CSS and Tailwind emits style
  attributes, and a nonce cannot reach either. Style injection is defacement, not execution.
