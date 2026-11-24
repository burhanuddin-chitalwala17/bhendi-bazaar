# ADR-0080: Every effect on a platform is a row claimed before the call

- **Date:** 2026-11-23
- **Status:** Proposed

## Context

Social selling sends messages, publishes posts, submits templates and updates catalogues on a shop's
behalf. A call can fail before it leaves, be refused, or time out after taking effect. Jobs run at
least once (ADR-0038). Without a record written before the call, a retry can send a buyer the same
offer twice, a crash can lose a post, and nobody can say what happened.

## Decision

1. **The row comes first.** Every outbound effect is a row in its owning domain's table, written in
   the business transaction together with its job, so both commit or neither does.
2. **One state machine:** `HELD → QUEUED → CLAIMED → SENT | FAILED | UNCERTAIN`. The worker claims a
   row with a conditional update from `QUEUED`; only a count of one proceeds to call the platform.
3. **Retry by kind.** Idempotent effects (catalogue upserts by retailer id, template submissions by
   name, a publish by container id) retry with backoff. A message is retried only on an error that
   says it was not sent; a timeout after sending is `UNCERTAIN`, settled later by the platform's
   status (WhatsApp's `biz_opaque_callback_data` carries our row id) or left for a person to decide.
   A duplicate message is worse than a missing one.
4. **Paced per account.** Calls for one account run under one lease per lane, at a rate taken from a
   dated limits table and slowed by the platform's usage headers.

## Alternatives considered

- **Call first, record after.** The common shortcut; a crash between the two loses the record and a
  retry duplicates the effect.
- **Retry everything until it succeeds.** Fine for idempotent calls, wrong for messages, which carry
  no idempotency key on either platform.
- **A shared distributed rate limiter.** Rejected in favour of per-account leases: no extra store,
  and two workers cannot exceed one account's limit.

## Consequences

- ✅ Exactly one effect per intent for messages, at least one for idempotent effects, and a record of
  every attempt.
- ✅ Outcomes a person sees are states of a row, so a reload shows the truth.
- ⚠️ `UNCERTAIN` is a state a person can meet ("Not sure it was sent"); rare, and honest.
