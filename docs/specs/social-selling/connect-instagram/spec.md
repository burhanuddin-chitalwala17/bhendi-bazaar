# Spec — social-selling/connect-instagram

- **Summary:** A shop connects its Instagram professional account by signing in on Instagram, and sees on the Channels page that the connection is healthy and kept alive
- **Status:** Draft
- **Domain:** channels
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [decisions.md](decisions.md), parent [social-selling](../spec.md) and its [decisions](../decisions.md), [channel-connectors](../../marketplace-integration/channel-connectors/spec.md), [INTEGRATIONS.md](../../../INTEGRATIONS.md#acting-for-a-shop-on-meta-catalogue-whatsapp-instagram), [ADR-0041](../../../adr/0041-a-channel-is-classed-by-where-the-sale-completes.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Requirements and product approach only. Technical approach lives in trd.md. Subfeature 1 of
> social-selling; every later Instagram subfeature acts through this connection.

## What this feature is
An Instagram card on the Channels page, in place of the Coming soon one. A member taps Connect
Instagram, signs in on Instagram, allows Bhendi Bazaar, and comes back connected. From then on the
card says, in plain words, which account it is, whether it is healthy, and what to do if not.

## Why
A shop posts, answers comments and replies to DMs through Bhendi Bazaar only once it has let us act
for its Instagram account. Instagram's own login needs only a professional account, no Facebook Page
(parent Q11), so this is the lightest way in. Publishing, the inbox and comment-to-DM all need a
connection we can trust and credentials nobody can read; this builds it once.

## Requirements
- R1 — Any member connects Instagram from the Channels page by signing in on Instagram's own page.
  We never ask for, see or store an Instagram password (Q11).
- R2 — A connection belongs to the shop and member that started it. A return from Instagram that
  did not begin in that session, has expired, or was altered connects nothing.
- R3 — Only a professional account connects, business or creator. A personal account connects
  nothing and is shown how to switch for free in the Instagram app, then offered a retry (Q3).
- R4 — One shop per Instagram account; an account connected to another shop is refused at once,
  with the reason. A reconnect with a different account is refused; switching is disconnect then
  connect (Q4, Q5).
- R5 — The connect asks Instagram for exactly the permissions the single review covers, so no shop
  reconnects when posting and the inbox arrive (Q2).
- R6 — Credentials are never shown, logged or returned to anyone, platform staff included; stored
  encrypted under a key that can be replaced without anyone reconnecting.
- R7 — The card shows its state in plain words: not connected, connected, needs reconnecting (with
  the reason), coming soon. When healthy: the username, business or creator, who connected it and
  when, and when it was last checked (Q7).
- R8 — The connection stays alive with nobody doing anything: we renew it well before Instagram's
  60 days run out, and say clearly when we cannot (Q6).
- R9 — A connection needing the shop (renewal failed, or our app removed inside Instagram) is also
  shown once on the shop's dashboard, with the action to fix it (Q9).
- R10 — A member can disconnect at any time, after confirming. Credentials are deleted, every call
  stops, and the dialog says how to remove Bhendi Bazaar in Instagram's settings too (Q8).
- R11 — When a person asks Meta to delete their data, the connection's credentials and Instagram
  details are deleted and Meta gets a confirmation the person can check (Q10).
- R12 — Where the platform has not opened Instagram, the card still answers the tap and says it is
  coming soon (Q11).

## Hazards the TRD must answer
- **The 60-day token lapses unnoticed.** A token unused for 60 days cannot be renewed at all, so
  renewal cannot wait for a later subfeature to use it.
- **Two renewals at once** replacing one token with two, keeping the wrong one.
- **A forged or replayed return** attaching someone else's Instagram account to a shop.
- **The account removes our app inside Instagram** while the card still reads Connected.
- **A deletion request names a person, not a shop.** It must find every connection they made.
- **Meta stops being feed-only.** ADR-0041 gives a shopfront no credentials; parent Q15 replaces
  that for Meta with a new ADR, written with the TRD.

## Product acceptance
Judged on a phone (~360px) first ([ADR-0015](../../../adr/0015-mobile-first-design.md)).
- A1 — A member taps Connect Instagram, approves on Instagram, and lands back on Channels showing
  the account's username as connected.
- A2 — A return URL replayed in another browser, edited, or older than ten minutes connects nothing.
- A3 — A personal account connects nothing and sees the steps to switch.
- A4 — An account already connected to another shop is refused with a reason; a reconnect with a
  different account is refused.
- A5 — A token renewed by the scheduled pass leaves the card Connected, with no one acting.
- A6 — Removing Bhendi Bazaar inside Instagram shows Needs reconnecting on the card and the
  dashboard by the next check.
- A7 — Disconnect leaves no stored credential; neither the database row, the logs nor any response
  contains a readable one.
- A8 — A data-deletion request from Meta removes that person's connection data and returns a
  confirmation.
- A9 — Every state in ux.md's matrix for the Instagram card can be reached and reads as written.
- A10 — Verified on the owner's own professional account, on dev, before any other shop (Q12).

## Scope
- **Outcome:** a shop connects its Instagram professional account and sees it healthy.
- **In:** R1–R12, tested by A1–A10.
- **Later:** publishing (instagram-publishing), comments and DMs (inbox-instagram), comment-to-DM
  (comment-automations), all parent subfeatures needing this one (Q1); ads (parent Q21).

## Open questions
Q13 (for ux-start), Q14 (for the TRD).
