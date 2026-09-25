# Spec — contact-us

- **Summary:** Anyone can reach the store from any page — by WhatsApp, or by a message emailed to its inbox
- **Status:** Implemented — PR-107
- **Domain:** notifications
- **Phase:** —
- **Verified:** 2026-09-16
- **References:** [trd.md](trd.md), [ADR-0013](../../adr/0013-one-error-envelope-and-useserverform.md), [ADR-0015](../../adr/0015-mobile-first-design.md), [ADR-0016](../../adr/0016-mobile-app-shell.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

A **Contact us** control on every storefront page that offers two ways to reach the
store: open WhatsApp on the store's number with the first line already written, or
write a short message that arrives in the store's email inbox.

## Why

A buyer who cannot find something, cannot complete a payment, or wants a garment in
another size has had nowhere to say so. The store answers on WhatsApp in practice, so
that fast path should be the real one; the written path exists for people who would
rather not use WhatsApp, and for anything that is better answered by email.

The store already works from an email inbox, so a message lands there rather than in a
second inbox the store would have to learn to check.

## Requirements

- R1 — On desktop, **Contact us** sits in the header immediately left of **Cart**, for
  signed-in people and guests alike.
- R2 — On a phone, **Contact** is the leftmost tab of the bottom bar, and **Home** is the
  centre tab. The bar reads Contact · Cart · Home · Orders · Account.
- R3 — Choosing it opens a panel that rises from the bottom on a phone and slides in from
  the right on desktop, offering exactly two options: WhatsApp, or send a message.
- R4 — **WhatsApp** opens a conversation with the store's published number carrying a
  general opening line the buyer can edit. It works from the app and from WhatsApp Web.
- R5 — **Send a message** replaces the options with a form in the same panel: a
  **subject** and a **message**. Sending confirms in place; nothing navigates, and a
  back gesture does not lose what was typed.
- R6 — A signed-in person is asked for nothing else — the store replies to the email on
  their account, and they cannot substitute another.
- R7 — A guest is additionally asked for their email, because otherwise there is nobody
  to reply to.
- R8 — Sending delivers one email to the store's support inbox. Replying to that email
  answers the sender directly.
- R9 — Nothing is stored and there is no admin-portal view: the email is the record.
- R10 — If the email cannot be sent, the sender is told so and pointed to WhatsApp —
  a message silently lost is the one outcome worse than a visible failure.

## Product acceptance

- A1 — On a ~360px phone, the bottom bar shows Contact first and Home in the middle;
  tapping Contact raises a sheet with both options full-width and thumb-reachable.
- A2 — On desktop, Contact us appears left of Cart whether or not anyone is signed in,
  and opens a panel from the right.
- A3 — Tapping WhatsApp opens WhatsApp with the store's number and a prefilled line.
- A4 — Signed in: the form has only Subject and Message; the email arriving at support
  has the account's address as its Reply-To.
- A5 — Signed out: the form also asks for an email, and that address is the Reply-To.
- A6 — With email delivery unavailable, sending shows an error and the typed message is
  still in the form.

## Out of scope (this feature)

- An admin-portal inbox, message history, or resolved/open tracking.
- An acknowledgement email to the sender.
- Attachments, and per-order or per-product "report a problem" entry points.
- Throttling: the route is unthrottled until [rate-limiting](../rate-limiting/) lands,
  accepted as a known gap.
