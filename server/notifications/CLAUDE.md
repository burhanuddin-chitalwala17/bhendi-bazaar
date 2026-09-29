# notifications — domain rules

- **Verified:** 2026-09-29
- **Covers:** `server/notifications/**`

Transactional email and in-app notifications ([in-app-notifications](../../docs/specs/in-app-notifications/spec.md)).
- Email: One provider (Resend, in `email.service.ts`), one shell, eight templates.
- In-App: `in-app.repository.ts`, `in-app.service.ts`, `in-app.types.ts`. Stores `InAppNotification` records per user with unread status tracking.

`contactMessageEmail.ts` is the one addressed to the store, not a buyer: Contact us delivers
a message to `SUPPORT_INBOX` with the sender as Reply-To and stores nothing, so its route
awaits the send and reports a failure ([contact-us](../../docs/specs/contact-us/trd.md) D2, D4).
A signed-in sender's Reply-To is the session's email, never one from the request body.
`biddingAlertEmail.ts` is the other store-bound one: an auction whose offers ran out, or a
paid order that found its offer already closed.

`bidOfferEmail.ts` is sent the moment an auction's offer opens — usually from the worker, at
the auction's end — and its send is **awaited** so a failure throws and the offer sweep resends
it ([winner-offer](../../docs/specs/bidding/winner-offer/trd.md) D10). Its deadline is formatted by `formatDeadline`, pinned to IST: `formatDate` takes the
sending machine's zone, and the worker's is UTC. The link it carries is minted by the caller at
the moment of sending and exists nowhere else, so never log the view it renders.

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

Verified: 2026-09-16
