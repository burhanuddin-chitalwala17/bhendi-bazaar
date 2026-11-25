# TRD — social-selling/consent-core

- **Status:** Accepted
- **Domain:** audience (new)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-23
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](ux.md), the architecture [TRD](../trd.md), [ADR-0024](../../../adr/0024-phone-is-contact-data-not-an-identity-key.md), [audience TRD](../audience/trd.md), [whatsapp-sending TRD](../whatsapp-sending/trd.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
Consent is an append-only event log with a current-state projection per (contact, sender,
channel). One question, `may(sender, contactRef, channel)`, answers yes or no with the reason, and
every sender asks it. Contacts are per shop; the same person at two shops is two contacts. The
first offer (Q11) is a consent request carried by a marketing message, sent once ever per contact.

## Prior art
- **Consent ledgers** (OneTrust, Segment's consent events, the GDPR/DPDP practice of keeping proof):
  an immutable event per change with source and evidence, and a projection for fast reads. Followed.
- **Keyword opt-in/opt-out** (Twilio's STOP handling, WhatsApp's own guidance): exact keyword in a
  message on its own, a free confirmation reply. Followed, with Hindi equivalents (Q5, Q9).

## Technical decisions
- **D1 — Model (R1, R2, Q6, Q7).** `Contact(id, orgId, bsuid nullable, phoneE164 nullable, name,
  nameSource TYPED|SYNCED|PLATFORM, email nullable, language EN|HI, source, firstOfferAt nullable,
  createdAt)`, unique (orgId, bsuid) and (orgId, phoneE164) where not null. `ConsentEvent(id,
  orgId nullable (null = Bhendi Bazaar), contactId, channel WHATSAPP|EMAIL, change OPT_IN|STOP,
  source, evidence JSON, at)`; `Consent(contactId, sender, channel, state, since, sourceEventId)`
  PK (contactId, sender, channel), written in the same transaction as its event. The platform's
  consents sit in the same tables with sender = PLATFORM (parent Q27).
- **D2 — The question (R3, Q8).** `audienceService.may(sender, contactId, channel)` → `{ yes } |
  { no, reason: NOT_OPTED_IN|STOPPED|NO_CHANNEL }`, one indexed read. It is called inside the
  sender's transaction (whatsapp-sending's port), so a STOP committed first wins.
- **D3 — Keywords (R4, Q5, Q9).** A sink on `InboundMessage` after inbox's: the trimmed,
  case-folded message equal to a keyword (YES, HAAN, हाँ; STOP, UNSUBSCRIBE, बंद, रोको; START;
  HINDI, ENGLISH) or a first-offer button payload changes consent for that shop and sends the
  confirming reply in the contact's language through `inboxService.sendAutomatic` (free: inside the
  window the buyer's message opened). Idempotent on the inbound message id.
- **D4 — Synced contacts (R6, Q1, Q12).** A sink on `ContactChange`: upsert by bsuid or phone; a
  synced name fills only an empty name; a removal deletes only a contact with no consent events and
  no conversation. A reconnect's sync (if Meta allows it, spike) runs the same sink; matches keep
  their consent.
- **D5 — First offer, once (Q11).** `firstOfferAt` is claimed with a conditional update
  (`WHERE firstOfferAt IS NULL`) by audience's first-offer job before the send; a contact with it set
  is never sent another. The template's buttons carry payloads `FO_YES:<contactId>` and
  `FO_STOP:<contactId>` read by D3.
- **D6 — Deletion and retention (R8, Q10).** `forgetPerson` deletes the contact and memberships
  everywhere and leaves `StopMarker(sender, channel, phoneHash, at)` (HMAC of the E.164 number) so an
  upload cannot re-add them; events older than 3 years after their contact's last change are
  deleted by `social.retention`.

## Packages
None.

## UI approach
ux.md's vocabulary (badges with words, never colour alone) as one `ConsentBadge` component in
`src/components/audience/`; the contact history section. Words in `audience-copy.ts`.

## Gates touched
New domain `audience`; one repository each for `Contact`, `ConsentEvent`+`Consent` (one aggregate:
the projection is written only with its event), `StopMarker`.

## Data model
[MIGRATION] D1, D6. Indexes: `(orgId, phoneE164)`, `(orgId, bsuid)`, `(orgId, lower(name))`,
`Consent (sender, channel, state)`, `ConsentEvent (contactId, at)`.

## API / contract changes
[CONTRACT] `may`, `recordOptIn` (checkout, store page), `recordStop`, `forgetPerson`.

## Test plan
- Keywords alone opt in or stop; in a sentence they do nothing; confirming reply in Hindi (A1).
- `may` across shops: opted in at shop A is no at shop B (A2).
- Synced contacts arrive Not yet (A3); an upload never revives a stopped person (A4).
- Deletion leaves the marker only (A5).
- Concurrency: STOP and a send racing; the send after commit is refused (integration).

## Delivery
1. **independent** — Model, `may`, events and projection (behaviour).
2. **after U1 and inbox-core U3 (`sendAutomatic` for the confirming reply)** — Keyword sink with replies; contact sync sink.
3. **after U1** — First-offer claim; deletion and retention.

## Open questions
None.
