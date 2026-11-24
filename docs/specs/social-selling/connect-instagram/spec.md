# Spec — social-selling/connect-instagram

- **Summary:** A shop connects its Instagram professional account by signing in on Instagram, is shown how to let Bhendi Bazaar see its messages, and sees on the Channels page that the connection is healthy and kept alive
- **Status:** Accepted
- **Domain:** channels
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-22
- **References:** [decisions.md](decisions.md), parent [social-selling](../spec.md) and its [decisions](../decisions.md) (Q1, Q2, Q3, Q8), [meta-foundation](../meta-foundation/spec.md), [channel-connectors](../../marketplace-integration/channel-connectors/), [INTEGRATIONS.md](../../../INTEGRATIONS.md#acting-for-a-shop-on-meta-catalogue-whatsapp-instagram), [ADR-0068](../../../adr/0068-meta-is-a-connected-shopfront.md)

> Requirements and product approach only. Technical approach lives in trd.md. Module: Connect.
> Stands on meta-foundation; instagram-publishing, inbox-instagram and comment-automations stand on it.

## What this feature is
An Instagram card on the Channels page. A member taps Connect, signs in on Instagram's own page,
and comes back to a connected card. That one connection is what posting, the Instagram inbox and
comment-to-DM all use later.

## Why
Every Instagram capability needs the shop's own grant. Asking for it once, with every permission
the single review covers, means no shop is asked again as later modules arrive (parent Q2). Most
Indian sellers have an Instagram but not a Facebook Page or business account, so the connection
asks for neither (parent Q1).

## Requirements
- R1 — Any member connects from the Channels page by signing in on Instagram's own page; we never
  ask for, see or store an Instagram password (parent Q8).
- R2 — A connection belongs to the shop and member that started it. A return from Instagram that
  did not begin in that session, has expired, or was altered connects nothing.
- R3 — A business or creator account connects. A personal account connects nothing and is shown how
  to switch for free in the Instagram app, then offered Try again (parent Q1).
- R4 — One shop per Instagram account; one already connected to another shop is refused at once,
  with the reason. A reconnect with a different account is refused; switching is disconnect, then
  connect (Q4).
- R5 — The connection asks for exactly the permissions the single review covers (Q2): publishing,
  comments and messages, so later modules never ask again.
- R6 — Right after connecting, and on the card for as long as no message has arrived, the shop sees
  the three taps that let Bhendi Bazaar see its messages (Instagram → Settings → Messages and story
  replies → Message controls → Connected tools → Allow access to messages). Where Meta tells us
  access is off, the card says so (parent Q1, Q16).
- R7 — The card says in plain words: not connected, connected, needs reconnecting (with the reason),
  coming soon. Connected shows the @username, business or creator, who connected it and when, and
  when it was last checked (Q8).
- R8 — The connection stays alive with nobody acting: renewed well before Instagram's 60 days run
  out, and it says so plainly when renewal fails (Q6).
- R9 — A connection needing the shop also shows once on the shop's dashboard, with the action that
  fixes it, through notifications-core (Q8).
- R10 — A member disconnects at any time after confirming; every call stops, credentials are
  deleted, and the dialog says how to remove Bhendi Bazaar in Instagram's settings too (Q8).
- R11 — The Instagram card sits after the Meta catalogue card, which keeps serving Facebook and
  Instagram shops from the feed (Q13).
- R12 — Until setup is done the card shows its checklist, each step ticked when done and opening its
  own screen, which returns to the card: Connect, Turn on replies, First post, Comment-to-DM. The
  next step is the card's main button (parent Q111).

## Hazards the TRD must answer
- **The 60-day token lapses unnoticed.** One unused for 60 days cannot be renewed, so renewal
  cannot wait for a later module to use the connection.
- **Two renewals at once** leave the wrong token kept.
- **A forged or replayed return** attaching someone else's account to a shop.
- **Message access cannot be read directly.** Whether Instagram exposes the toggle, or only an error
  on reading or sending, is to be found in the TRD's spike; R6 holds either way (Q16).

## Product acceptance
Judged on a phone (~360px) first ([ADR-0015](../../../adr/0015-mobile-first-design.md)).
- A1 — A member taps Connect Instagram, allows on Instagram, and lands on Channels with the
  @username connected and the message-access steps shown.
- A2 — A return replayed in another browser, edited, or older than ten minutes connects nothing.
- A3 — A personal account connects nothing and sees the steps to switch.
- A4 — An account in another shop is refused with the reason; a reconnect with another account is refused.
- A5 — The scheduled renewal leaves the card Connected with no one acting.
- A6 — Removing Bhendi Bazaar inside Instagram shows Needs reconnecting on the card and the dashboard.
- A7 — After disconnect no readable credential exists in the database, the logs or any response.
- A8 — Every state in ux.md reads as written; verified first on the owner's own account, on dev (parent Q2).

## Scope
- **Outcome:** a shop connects its Instagram professional account and sees it healthy.
- **In:** R1–R12, tested by A1–A8.
- **Later:** a Facebook Page connection and ads (parent Q21). Built on this: instagram-publishing,
  inbox-instagram, comment-automations.

## Open questions
None.
