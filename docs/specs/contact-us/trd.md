# TRD — contact-us

- **Status:** Implemented — PR-107
- **Domain:** notifications, with UI in the storefront chrome
- **Phase:** —
- **Verified:** 2026-09-16
- **References:** [spec.md](spec.md), [ADR-0013](../../adr/0013-one-error-envelope-and-useserverform.md), [ADR-0015](../../adr/0015-mobile-first-design.md), [ADR-0016](../../adr/0016-mobile-app-shell.md), [ADR-0022](../../adr/0022-design-decisions-go-through-tokens.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach

No new domain and no table. A message is one transactional email to the store, so it
is a template and a `send*` method in `server/notifications/`, following that domain's
own rule for adding an email. One public route, `POST /api/contact`, parses the body
and hands the email to the service.

The storefront side is one sheet with two steps — choose, then write — opened by one
launcher component that the header and the bottom tab bar each style for themselves.
WhatsApp needs no server: it is a `wa.me` link built from one constant.

## Technical decisions

- **D1 — WhatsApp is a link, not an integration.** `wa.me/<digits>?text=…` opens the app
  on a phone and WhatsApp Web on desktop with no account, token or API dependency. The
  number is a brand fact in `src/lib/config.ts`; `src/lib/support-contact.ts` is the
  only place the URL is built, because a `+` in the path silently breaks it.
- **D2 — Email only, sent to support with Reply-To set to the sender.** The store already
  works from that inbox, so answering is an ordinary reply. Storing messages was
  considered and dropped: it would add a table, a migration and a portal page for
  history the inbox already keeps. `SendEmailOptions` gains an optional `replyTo`.
- **D3 — The reply address is the session's when signed in, never the body's.** The
  signed session is the one input the sender cannot write, so a signed-in body's
  `email` is ignored. Two schemas express it: subject + message for everyone, the same
  plus `email` for a guest, shared by the route and the form (ADR-0013).
- **D4 — The route awaits the send.** Other emails fire without awaiting because they
  follow a committed action; here the email *is* the action, so a failure must reach
  the sender through the error envelope rather than be logged and forgotten.
- **D5 — Unthrottled, deliberately and visibly.** `withRateLimit` allows everything while
  the cache is detached, and with no table there is nothing to count. The call is kept
  so reconnecting the limiter covers this route. Accepted as a gap, not described as
  protection.
- **D6 — One launcher, two placements.** The trigger owns the open state and mounts its
  own sheet, so the header and the tab bar need no shared state. On desktop the header
  button is `hidden md:inline-flex`, which ADR-0015 permits because the tab bar is the
  phone's affordance in the same change.
- **D7 — The sheet grows an `adaptive` side rather than a second component.** A bottom
  sheet on a phone, a right-hand panel from `md`, on the same Radix dialog, so focus
  trapping and Escape are identical. The phone's vertical slide is reset at `md` so the
  two animations do not combine into a diagonal one.

## Packages

None. `resend` already supports `replyTo`; the sheet is Radix's dialog primitive.

## UI approach

**Phone first (~360px).** The bottom bar gains a fifth tab and reorders to Contact ·
Cart · Home · Orders · Account; Contact never shows as active, since it opens a sheet
rather than a page. The sheet carries a close button, then two stacked 56px option rows.
Choosing Send a message replaces them with Subject and Message (and Email, for a
guest); inputs keep the 16px mobile base. Sending swaps the body for a confirmation.

**Desktop (`md`+).** An outline **Contact us** pill sits left of Cart in the header for
everyone. The same sheet opens as a full-height panel from the right, and its grab
handle is hidden. WhatsApp's green comes from `src/lib/social-brand.ts` (ADR-0022).

## Data model

None.

## API / contract changes

None in CONTRACTS.md: one route, one consumer. Failures use `toErrorResponse`, and a
guest's missing email is attributed to the `email` field.

## Test plan

- `tests/unit/contact-email.test.ts` — session address wins over the body; a guest's
  address is used; a guest without one is a 400 on `email`; a failed send is a 500;
  the template escapes and keeps line breaks.
- `tests/unit/contact-sheet.test.tsx` — both options; the `wa.me` href; the adaptive
  side; signed-in form has no email field, a guest's does; confirm in place.
- `tests/unit/contact-whatsapp.test.ts` — the URL builder; `email-templates.test.ts`
  includes the new template in the shared-shell check.

## Delivery (PRs)

One PR.

## Open questions

None.
