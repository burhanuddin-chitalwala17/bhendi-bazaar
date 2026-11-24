# ADR-0069: Notifications are one hub every module plugs into

- **Date:** 2026-11-06
- **Status:** Proposed

## Context

Every module that tells a person something sends its own email: checkout the receipt, shipping
the parcel notices, bidding the outbid email. Social selling adds WhatsApp, consent per sender and
channel, a per-shop spend cap, frequency caps and a daily window, and its own events (a waiting DM,
a failed post). Copying those rules into each sender would put consent and money checks in a dozen
places, and the owner asked that notifications be a global module that social selling plugs into
and out of ([social-selling](../specs/social-selling/decisions.md) Q41, Q66, Q68).

## Decision

1. **A module emits an event; the hub chooses the channel.** An event carries its kind, audience,
   shop, recipient and facts. No emitting module imports a channel.
2. **A channel is a plug behind one port** in `server/notifications/`: email, WhatsApp (delegating
   to the campaigns domain's send port, which keeps WhatsApp consent, STOP, spend cap and
   WhatsApp's frequency cap) and the unread badge. In-app and push are later plugs.
3. **Every delivery is a row first**, unique per (event key, recipient, channel), written in the
   emitter's transaction; only a new row enqueues a send, keyed on that row.
4. **Policy lives in the hub, facts live with the channel.** The hub owns which events a shop has
   switched on and channel order (WhatsApp first, else email); alerts wait for the shop's hours
   (social-selling Q112). A channel owns what only it knows: its consent records, its cost and its
   delivery status. The shop's one how-often rule and its spending limit (social-selling Q40, Q8)
   are campaigns' facts: every marketing delivery on any channel records a touch, and the rule is
   checked under a lock per buyer, so no burst passes it. Revised 2026-11-23 while Proposed
   (social-selling TRD A-D19); was: a global cap and a daily window owned by the hub, read from
   each channel's counts.
5. **The hub grows inside `server/notifications/`**; it is not a new domain.

## Alternatives considered

- **Each module keeps sending its own messages** (the status quo). Rejected: consent, caps and the
  WhatsApp-else-email rule would be re-implemented per sender, and a missed check costs a shop
  money or its WhatsApp number's rating.
- **A hosted notification service (Novu, Knock, Courier).** Rejected: a new vendor holding buyer
  phone numbers and consent (DPDP), monthly cost, and WhatsApp still sent from the shop's own
  account, which such services reach only through a provider we decided against (social-selling Q4).
- **Put the hub inside social selling.** Rejected: order updates and outbid emails are not social,
  and the owner asked for the two to be decoupled (social-selling Q66).
- **Let the hub own every cap, WhatsApp's included.** Rejected: a campaign sent by social selling
  would then bypass the cap or keep a second copy; WhatsApp's spend and rating are WhatsApp facts
  (social-selling Q68).

## Consequences

- ✅ A new channel is one plug; a new module is one event kind. Neither knows the other.
- ✅ One place enforces consent order, the global cap and the shop's window.
- ✅ The delivery row gives a record of what was sent to whom, once.
- ⚠️ Every existing email sender moves onto the hub over time; until then two paths exist, so each
  move is a named unit (order-updates moves parcel notices; demand-alerts moves outbid).
- ⚠️ Every marketing send takes a lock per buyer to check the how-often rule; a short wait, in
  exchange for no burst ever passing it.
