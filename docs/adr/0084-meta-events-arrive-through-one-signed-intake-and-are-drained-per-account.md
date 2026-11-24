# ADR-0084: Meta events arrive through one signed intake and are drained per account

- **Date:** 2026-11-23
- **Status:** Proposed

## Context

Social selling ([social-selling TRD](../specs/social-selling/trd.md) A-D5–D7) receives everything
from Meta by webhook: messages, comments, statuses, template verdicts, contact changes, account
updates. Meta delivers at least once, out of order, in bursts (a viral post), retries for days when
not acknowledged, and disables an app's webhooks after sustained failures. A handler that does the
work inside the request is slow under a burst, loses work when it crashes half-way, and processes
two events of one conversation in parallel.

## Decision

1. **One intake verifies, stores and acknowledges.** Each Meta product's webhook route checks
   `X-Hub-Signature-256` with the app secret in constant time, writes one `MetaEvent` row per change
   with a dedupe key per event kind (`ON CONFLICT DO NOTHING`), and answers 200. It does no other
   work. A storage failure answers 500 so Meta retries.
2. **Events for accounts we do not hold are dropped and acknowledged**: no payload is kept, a daily
   count is, shown on the admin overview; never answered non-2xx: late events after a disconnect are normal, and
   repeated failures would disable the app's webhooks.
3. **A drain job per connection** turns stored events into neutral facts, in occurrence order, under
   a lease that keeps one drain per account at a time. A poison event is retried five times, then
   marked dead and skipped, so one bad event never blocks a shop.
4. **Facts reach their owners through sinks.** `channels` translates Meta's shapes into neutral
   facts declared in `server/shared/`; tool domains register sinks for the facts they own when the
   worker starts. `channels` never imports a tool. Every sink is idempotent on the fact's key.
5. **Raw events are sealed and short-lived**: encrypted under the platform key ring and deleted
   after 30 days (social-selling meta-foundation Q2). What an event caused is kept by the domain that
   owns it.

## Alternatives considered

- **Process inside the request.** The common first version, and Razorpay's handler here. Rejected
  for volume and ordering: a burst holds functions open, a crash loses the tail of a delivery, and
  two deliveries for one conversation race.
- **One queue job per event.** Simple and parallel, rejected for cost and order: a thousand comments
  become a thousand queue rows, and per-conversation order is lost across workers.
- **A hosted webhook relay (Hookdeck, Svix).** Rejected: a new vendor holding message payloads
  (DPDP, chat privacy Q116) for a problem a table and a job solve.

## Consequences

- ✅ The route stays fast under any burst; at-least-once delivery becomes exactly-once effects.
- ✅ Per-account order; parallelism across shops.
- ✅ Failures are rows an admin can count, not log lines.
- ⚠️ The intake departs from the Razorpay rule that an unmatched payload answers non-2xx; the
  reason is in decision 2, and the count keeps it visible.
- ⚠️ Effects lag the webhook by a drain's start (about a second); nothing in the specs needs less.
