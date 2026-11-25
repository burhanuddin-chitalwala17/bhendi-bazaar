# notifications — domain rules

- **Verified:** 2026-11-25
- **Covers:** `server/notifications/**`

Transactional email. One provider (Resend, in `email.service.ts`), one shell, eight templates.

**A send from a job is keyed on the job.** `notifications.jobs.ts` holds the worker's handlers (today
`org.email-changed`, org-profile Q25); each passes an `idempotencyKey` derived from the job id, so a
redelivered job is one email (ADR-0038 D4). The job's spec lives in `server/shared/jobs/`, so the
domain that enqueues it never imports this one.

**A parcel email is an event on the hub** (order-fulfilment (`431ed6e7:docs/specs/own-store/order-fulfilment/trd.md`) D8,
notifications-core D6). `notice.service.ts` emits it on the caller's transaction, keyed per (parcel, kind,
audience, ref), as one email delivery at once to the address resolved when written; the event names its
`shipmentId`, which is how shipping's sweeps skip a parcel already told and the admin's history is read. Kinds
and wording: `notice.types.ts`, `templates/parcelNoticeEmail.ts`; sent by the email plug, keyed `notice-<id>`.
`notify.send` only drains jobs queued before the move. A notice's data never holds a buyer phone or address (spec A10).

**The hub: a module emits, the hub delivers** ([ADR-0069](../../docs/adr/0069-notifications-are-one-hub-every-module-plugs-into.md),
notification-hub/notifications-core). `notificationsService.emit(tx, { kind, orgId, audience, facts, eventKey })`
writes a `NotificationEvent` (unique key) and one `Delivery` per (event, recipient, channel) on the emitter's
transaction; a repeated key writes nothing. `policy.ts` alone picks channels and timing per kind; a module never
names a channel. Only an `AT_ONCE` row enqueues `notify.deliver`; `DIGEST` rows wait for the morning email; a
`badge` row still `PENDING` *is* the unread badge. Channels are plugs in `plugs.ts`. Facts are ids only, refused
otherwise by `eventFacts`; a member's address is read when sending, never stored (a parcel notice keeps its
snapshot and address, as `Notice` did: Q15). A kind's owner registers `stillOpen`
so the Needs you list drops what was fixed (marked `SUPERSEDED`).

**What waits, and for how long** (notifications-core D3, D4, D7). A check is registered in `still-open.registry.ts`
only, and every reader of open items (the bell route, the morning job) calls `registerStillOpenChecks()` first (Q10).
The morning email is `notify.digest`, queued for the next 09:00 IST by the `emit` that writes a DIGEST row (Q12);
it settles every row it covers, so a twin run sends nothing, and a failed send leaves its rows waiting and fails the
job. A member's off switch is `MemberNotificationPrefs` (no row = on); the badge and at-once alerts have none.
`social.retention` (queued daily by `channels.maintain`) deletes events past 13 months, their deliveries by cascade (Q7, Q11).

`contactMessageEmail.ts` is the one addressed to the store, not a buyer: Contact us delivers
a message to `SUPPORT_INBOX` with the sender as Reply-To and stores nothing, so its route
awaits the send and reports a failure (contact-us (`431ed6e7:docs/specs/contact-us/trd.md`) D2, D4).
A signed-in sender's Reply-To is the session's email, never one from the request body.

## Every email renders through `renderEmail`

`templates/layout.ts` owns the whole document — doctype, head, stylesheet, accent bars,
header, optional banner, footer. A template supplies **only what differs**: title, tagline,
body, and any CSS the shared sheet does not already carry.

A template that writes its own `<!DOCTYPE>`, `<head>`, header or footer is a defect — that
is exactly the duplication this file exists to prevent, and it is how four emails came to
carry four copies of the same footer. `tests/unit/email-templates.test.ts` fails a second
`email-wrapper` in one document.

**Adding an email:** a new file in `templates/`, returning `renderEmail({...})`, plus a
`send*` method on `EmailService`. Compose the body from the layout's blocks — `greeting`,
`paragraph`, `closingNote`, `button`, `noticeBox`, `alternateLink`, `detailPanel` — and add
a block there rather than a second hand-rolled copy of one.

## Interpolated data is escaped

Names, addresses, order notes and product titles are typed by people, so every one of them
goes through `esc()` (Invariant 4's reasoning, applied to output). `paragraph` and the other
block helpers take *markup* and do not escape it — escape the values you interpolate into it.
`greeting` and `renderEmail`'s own fields escape for you.

## Money

Templates format with `formatPaise` from `formatters.ts` — integer paise in, rupees out
([ADR-0004](../../docs/adr/0004-money-as-integer-paise.md)). This module is the documented
exception to "server code never formats money": an email has no client to format it.

## Brand facts are declared here, not imported

`BRAND_NAME` / `BRAND_TAGLINE` live in `layout.ts` because `server/` must not import from
`src/`. Absolute links come from `appUrl()`, never a hardcoded origin.
