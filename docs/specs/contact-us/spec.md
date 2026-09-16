# Spec — contact-us

- **Status:** Implemented — PR-107
- **Domain:** support (new bounded context)
- **Phase:** —
- **Verified:** 2026-09-16
- **References:** [trd.md](trd.md), [ADR-0013](../../adr/0013-one-error-envelope-and-useserverform.md), [ADR-0015](../../adr/0015-mobile-first-design.md), [ADR-0021](../../adr/0021-audit-trail-never-fails-the-action.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

One **Contact us** entry point on the storefront that offers a person two ways to reach
the store: write a message that lands in the admin portal, or open WhatsApp on the
store's number with the first line already written.

## Why

A buyer who cannot find something, cannot complete a payment, or wants a garment in
another size has nowhere to say so. Every route out of the store today is one a person
has to already know — no address, no number, no form. The store answers on WhatsApp in
practice, so the fast path should be the real one, and the slower path should still leave
a written record the store can work through rather than an email nobody owns.

The two options are not the same thing and neither replaces the other. WhatsApp is
immediate and belongs to the buyer's own phone; a message is asynchronous, survives, and
is the only one of the two that can be answered days later by whoever is at the console.

## Requirements

- R1 — A **Contact us** control sits directly above **Logout** in the account menu, so a
  signed-in person finds it where they already look for account actions.
- R2 — Choosing it offers exactly two options, each labelled for what it does: send a
  message, or continue on WhatsApp.
- R3 — **WhatsApp** opens a conversation with the store's published number, carrying a
  general opening message the buyer can edit or send as-is. It must work from a phone
  (the app) and from a desktop browser (WhatsApp Web).
- R4 — **Message** opens a form in place — name, email, an optional subject, and the
  message — and confirms in the same place when it is sent. Leaving the store, or losing
  what was typed, is a failure of this requirement.
- R5 — A signed-out visitor can also reach both options, because someone who cannot sign
  in is exactly the person who needs to make contact. Their entry point is the footer.
- R6 — For a signed-in person the name and email shown are the ones on their account and
  are not theirs to retype: the store must know who wrote, not who claimed to.
- R7 — Every message arrives in the **admin portal** as a list, newest first, with who
  wrote it, when, whether they were signed in, and its full text.
- R8 — An admin can mark a message **Resolved** and back again, and filter the list by
  that state, so the portal answers "what is still open" rather than growing forever.
- R9 — Nothing is emailed. The portal is the inbox for this feature.
- R10 — A person cannot flood the store: repeated submissions in quick succession from
  the same sender are refused with a message they can act on.

## Product acceptance

- A1 — On a ~360px phone, signed in: the account menu shows **Contact us** above
  **Logout**; tapping it raises a sheet from the bottom with two options at full width
  and both thumb-reachable; the sheet never covers its own content or the home
  indicator.
- A2 — Tapping **WhatsApp** opens WhatsApp with the store's number and a prefilled
  message; going back returns to the store with nothing lost.
- A3 — Tapping **Message**, filling it in, and sending shows a confirmation in the sheet
  without a page navigation; the message appears in the admin portal under **Contact**.
- A4 — Signed out, from the footer: both options work, and the message form asks for a
  name and email.
- A5 — A signed-in sender's name and email in the portal match their account, whatever
  the browser sent.
- A6 — Marking a message Resolved in the portal, then filtering to Open, removes it from
  the list; the audit trail records who resolved it.

## Out of scope (this feature)

- Replying from the portal — the reply happens on WhatsApp or in the admin's own mail
  client. A threaded conversation is a later feature.
- Email notification to the store when a message arrives.
- Attachments, and any per-order or per-product "report a problem" entry point.
- A public `/contact` page, and a published postal address.
- Real throttling of the guest path, which needs [rate-limiting](../rate-limiting/).
