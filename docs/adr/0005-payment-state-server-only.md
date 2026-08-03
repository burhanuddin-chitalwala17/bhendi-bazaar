# ADR-0005: Payment state changes only on a verified gateway signal

- **Date:** 2026-08-03
- **Status:** Accepted
- **Context:** Payment state was effectively client-declared. `paymentStatus` was accepted both at order creation and on update; the signature-verification endpoint validated an HMAC, returned a boolean, and wrote nothing; and the browser was trusted to report the outcome afterwards. The intended server-authoritative path — the gateway webhook — did not run at all, because the key it read from the payment's `notes` was not the key orders were created with.

  That last fact explains the others, and is the reason this ADR exists in the form it does: **a silently dead server-side path gets replaced by a client-side one.** The webhook failed by doing nothing and returning success, so a client-driven state update was added to make checkout appear to work, and that workaround became the mechanism. The rule that follows is not just "verify server-side" but "a verification path that cannot fail loudly will be worked around" — hence the loud-failure and idempotency requirements below, which matter as much as the single-writer rule.
- **Decision:**
  1. **Exactly one writer.** `paymentStatus: "paid"` is set in one place: a server handler that has (a) verified the gateway signature, (b) loaded the persisted order by id, and (c) confirmed the gateway amount equals `order.grandTotal`. All three, in that order, before the write.
  2. **`paymentStatus` is not client-writable.** Removed from `createOrderSchema` and from `updateOrderSchema`. Orders are always created `"pending"`, hardcoded server-side.
  3. **The webhook is the primary path**, and the `notes` key is fixed. `/api/payments/verify` becomes a *writer* rather than an oracle: it performs the same three checks and updates state, so a customer's browser returning promptly and the webhook arriving later are two routes to the same idempotent transition.
  4. **The transition is idempotent.** Re-processing the same payment id is a no-op, not a second confirmation email.
  5. **Webhook failures are loud.** A webhook whose `notes` lookup finds no order logs an error and returns non-2xx so the gateway retries and the failure is visible. Silently returning 200 on an unrecognised payload is forbidden — that is precisely what hid this bug.
  6. **HMAC comparisons use `crypto.timingSafeEqual`**, not `===`. Signature comparison lives in `server/repositories/razorpayRepository.ts`.
- **Alternatives considered:**
  - *Keep the client `PATCH` but require a session and ownership* — rejected. It authenticates the caller but still lets the *customer* declare their own payment outcome; a customer who abandons the gateway can still assert success.
  - *Poll the gateway for payment status instead of using webhooks* — rejected as the primary mechanism (latency, rate limits) but retained as a **reconciliation** job: a periodic sweep of orders stuck `pending` past a threshold, which is the correct backstop for a missed webhook and would have surfaced this bug on day one.
  - *Trust the signed `razorpay_signature` returned to the browser without an amount check* — rejected. The signature attests that *a* payment happened against a gateway order; it says nothing about whether that gateway order's amount matched ours. See [ADR-0002](0002-server-holds-pricing-authority.md).
  - *Verify in middleware rather than the handler* — rejected. The middleware matcher excludes `/api` entirely, and signature verification needs the raw body, which middleware should not consume.
- **Consequences:**
  - ✅ Payment state becomes unforgeable: it derives only from a gateway-signed fact matched to a persisted amount.
  - ✅ Fixing the `notes` key restores the intended architecture, letting the client-side workaround be deleted rather than patched.
  - ✅ Idempotency makes webhook retries safe, which in turn makes failing loudly safe.
  - ⚠️ The confirmation email moves onto the verified path. It will arrive slightly later — after gateway confirmation rather than on the browser's optimistic report — which is correct but a visible behaviour change.
  - ⚠️ Requires the Razorpay webhook to be reachable and configured per environment, including local development (tunnel) — previously it did not matter that it was broken, and that was the problem.
  - ⚠️ Orders currently marked paid were marked by the browser and are not evidence of payment. Reconcile against gateway settlement before trusting historical `paymentStatus`.
