# Spec — social-selling/consent-core

- **Summary:** Bhendi Bazaar knows, for every shop and buyer, whether that shop may send them marketing on WhatsApp or email, from a consent it can prove; buyers opt in and stop in a chat, and a shop's phone contacts arrive as people not yet asked
- **Status:** Accepted
- **Domain:** audience
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-22
- **References:** [decisions.md](decisions.md), parent [social-selling](../spec.md) and its [decisions](../decisions.md) (Q9, Q12, Q27, Q34, Q37, Q96), [connect-whatsapp](../connect-whatsapp/spec.md), [whatsapp-sending](../whatsapp-sending/spec.md), [audience](../audience/spec.md)

> Requirements and product approach only. Technical approach lives in trd.md. Module: Reach out.
> Built in step 5, before inbox-whatsapp: every send asks it first. Its screens are audience's.

## What this feature is
The record behind every marketing message: who said yes to whom, on which channel, when, and how
we know. It answers one question for the whole platform, "may this sender message this person on
this channel?", and it is where a buyer's YES and STOP in a chat land.

## Why
A contact is not consent (parent Q9). A shop that messages people who never asked gets its number
reported and its templates paused, and India's DPDP Act requires proof of consent. Keeping that
proof in one place, asked by every sender, makes it impossible to message someone by mistake.

## Requirements
- R1 — A contact is one person known to one shop: keyed by Meta's business-scoped id with the phone
  when Meta gives it, or by phone for one from an order or upload. The same person at two shops is
  two contacts; neither shop sees the other's (Q6, parent Q96).
- R2 — Consent is kept per sender (each shop, and Bhendi Bazaar) and per channel (WhatsApp, email),
  as Opted in or Stopped, with source, time and evidence; Not yet is the absence of an opt-in (Q7).
  Every change is added to its history, never overwritten.
- R3 — Every sender asks one question, "may S message this person on C?", and gets yes or no with
  the reason; nothing sends marketing without asking (Q8).
- R4 — In a chat with a shop, YES (or HAAN, हाँ) opts in to that shop on WhatsApp, STOP (or
  UNSUBSCRIBE, बंद, रोको) stops it at once, and HINDI switches that shop's messages to Hindi. Each
  gets one free confirming reply in the buyer's language; the shop's own words never count (Q5, Q9).
- R5 — A stopped person can opt in again by any source; an uploaded list can never opt them back in (Q9).
- R6 — A shop's phone contacts, from the one sync at connect, arrive as Not yet, with their names
  filling only names nobody typed; later changes on the phone follow; a contact removed on the phone
  leaves only if it has no consent history and no conversation (Q1). Each may be sent one first
  offer, ever, that asks for consent in it: Yes or YES opts them in, Stop or STOP stops them, no
  reply leaves them Not yet for good. The same holds for contacts uploaded from a file and for each
  contact synced later, including a fresh sync after connecting again (Q11, Q12).
- R7 — Buyers from before this feature are Not yet and are never chased (parent Q9).
- R8 — Consent history is kept three years after its last change. A person's deletion request removes
  them from every shop, leaving only a marker that they stopped, so no upload can re-add them (Q10).

## Hazards the TRD must answer
- **A STOP racing a send** already on its way.
- **The same person under two ids** (phone, then a business-scoped id) at one shop.
- **A word inside a sentence** ("don't stop sending") read as STOP.

## Product acceptance
- A1 — A buyer sending YES to a shop's number is opted in for that shop on WhatsApp and gets the
  confirming reply; STOP stops it and confirms.
- A2 — A sender asking about a person opted in to another shop only gets no, with the reason.
- A3 — A shop's 300 phone contacts arrive as Not yet; each can be sent one first offer, and only
  those who tap Yes become Opted in; a second first offer to the same contact is refused.
- A4 — An uploaded list containing someone who stopped leaves them stopped.
- A5 — A deletion request removes the person from every shop and leaves the stop marker.

## Scope
- **Outcome:** every marketing send rests on a consent the platform can prove.
- **In:** R1–R8, tested by A1–A5. Screens: none; audience shows it, and the first offer.
- **Later:** a buyer's own page of their consents across shops.

## Open questions
None.
