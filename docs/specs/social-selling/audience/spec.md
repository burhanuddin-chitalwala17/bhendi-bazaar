# Spec — social-selling/audience

- **Summary:** A shop's contacts and their consent, per sender and channel: opt-ins from checkout, the store page, a chat or an attested upload; STOP honoured at once; saved lists of opted-in contacts to message
- **Status:** Draft
- **Domain:** audience (new)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [decisions.md](decisions.md), [ux.md](ux.md), [trd.md](trd.md), parent [social-selling](../spec.md) and its [decisions](../decisions.md), [whatsapp-contacts](../whatsapp-contacts/spec.md), [ADR-0024](../../../adr/0024-phone-is-contact-data-not-an-identity-key.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Requirements and product approach only. Technical approach lives in trd.md. Subfeature 5 of
> social-selling. Platform-free: it knows nothing of WhatsApp's API (parent Q7); the WhatsApp parts
> of opt-in arrive as neutral events from `channels`.

## What this feature is
An Audience page in the shop's portal: everyone the shop may message, and everyone it may not yet.
Each contact shows, per channel, whether they opted in, from where and when, or stopped. The shop
builds named lists from opted-in contacts to send campaigns to. Buyers opt in at checkout or from
the shop's store page; a shop may also upload a list it has permission for.

## Why
A message to someone who never agreed gets the shop's WhatsApp number reported and its templates
paused, and breaks DPDP (parent Q9). Every campaign and alert needs one answer it can trust: may
this shop send this person this kind of message, on this channel, right now? This builds that
answer once, for every sender and channel, so no caller can skip it.

## Requirements
- R1 — A contact belongs to one shop. The same person at two shops is two contacts, and neither
  shop sees the other's (Q1).
- R2 — Consent is held per sender (each shop, and Bhendi Bazaar) and per channel (WhatsApp, email),
  with its source, time and evidence; every change is kept as history (parent Q27, Q3).
- R3 — Checkout shows one unticked box naming the shops in the order, Bhendi Bazaar, WhatsApp and
  email. Ticked on a paid order, it opts the buyer in for each named sender on both channels (Q5, Q8).
- R4 — A shop with WhatsApp connected shows "Get offers on WhatsApp" on its store page. It opens
  WhatsApp with YES pre-filled to the shop's number; sending it opts that person in (parent Q9, Q12).
- R5 — YES (or HAAN, हाँ) in any chat with the shop opts in; STOP (or UNSUBSCRIBE, बंद, रोको)
  stops that shop's WhatsApp consent at once, with one confirming reply. The email link stops
  that sender's email. Nothing else is touched (parent Q9).
- R6 — A shop uploads a CSV or spreadsheet; ticking "These people agreed to get WhatsApp messages
  from <shop>" makes them opted in, recorded with who, when and which file. Without the tick they
  are Not yet. An upload never re-opts-in someone who stopped (parent Q9, Q14, Q7).
- R7 — Buyers from before this feature, and contacts synced from the shop's phone, are Not yet
  and are never messaged for marketing until they opt in (parent Q9).
- R8 — A shop saves named lists: opted-in contacts narrowed by category bought, wishlisted, last
  order within N days, or uploaded list. Counts are live; a contact who stops leaves every list at
  once (parent Q75).
- R9 — A buyer may reply HINDI to get Hindi from that shop (parent Q37).
- R10 — Phones are masked to the last four digits; the full number shows on tap, recorded (Q19).
- R11 — A person's deletion request removes them from every shop, keeping only a marker that they
  stopped, so no upload can bring them back (Q21). Contacts go 90 days after a shop's last
  messaging channel disconnects; consent history is kept three years after its last change (Q21).
- R12 — Other features ask one question, "may sender S message this phone on channel C?", and get
  yes or no with the reason. Audience counts no sends and holds no caps (parent Q40, Q21).

## Hazards the TRD must answer
- **A STOP racing a send.** A campaign that checked consent a second before STOP arrived must not
  send after it; the answer is read at the moment of the send.
- **A re-upload undoing a STOP**, or a deletion. Suppression must outlive the contact.
- **Two webhooks for one YES** (Meta delivers at least once) creating two consent rows.
- **Phones in two formats** (`98…` and `+9198…`) becoming two contacts.
- **A list membership read from a stale copy** reaching someone who stopped.
- **Audience reaching into checkout or wishlist tables**, breaking ADR-0033.

## Product acceptance
Judged on a phone (~360px) first ([ADR-0015](../../../adr/0015-mobile-first-design.md)).
- A1 — A guest ticks the box, pays; the shop's Audience shows them Opted in on WhatsApp and email,
  source Checkout, with the order as evidence. An unpaid checkout shows nothing.
- A2 — A visitor taps "Get offers on WhatsApp", sends YES; they appear Opted in, source Store page.
- A3 — STOP in that chat shows Stopped within a minute; a list's count drops by one; the
  platform's consent for the same person is unchanged.
- A4 — An upload of 200 rows with 3 bad phones and the tick: 197 Opted in, 3 skipped with the
  reason, the attestation recorded; a stopped contact in the file stays Stopped.
- A5 — A list "Kurta buyers, last 90 days" counts only opted-in contacts and changes as they do.
- A6 — "May shop S message phone P on WhatsApp?" answers no for Not yet, Stopped and another shop's
  contact, yes only for an opt-in.
- A7 — A deletion request leaves no contact, and a later upload of that phone stays Stopped.
- A8 — Every state in ux.md's matrices can be reached and reads as written.

## Scope
- **Outcome:** a shop knows who it may message and keeps lists of them.
- **In:** R1–R12, tested by A1–A8. The checkout box and the store-page button are In: R3 and R4
  need them.
- **Later:** contact export (Q19); a platform contact screen (parent Q27); syncing the phone's
  contacts (whatsapp-contacts); sending anything (whatsapp-campaigns, notification-hub).

## Open questions
None. Q8, Q21, parent Q37 decided by the owner 2026-11-06.
