# Spec — social-selling/whatsapp-contacts

- **Summary:** The contacts on a shop's WhatsApp Business app arrive in its Audience as Not yet and stay in step; a buyer's YES or STOP in a WhatsApp chat changes their consent at once, confirmed in the chat
- **Status:** Draft
- **Domain:** audience, fed by channels
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [decisions.md](decisions.md), [ux.md](ux.md), [trd.md](trd.md), parent [social-selling](../spec.md) and its [decisions](../decisions.md), [audience](../audience/spec.md), [connect-whatsapp](../connect-whatsapp/), [INTEGRATIONS.md](../../../INTEGRATIONS.md#acting-for-a-shop-on-meta-catalogue-whatsapp-instagram)

> Requirements and product approach only. Technical approach lives in trd.md. Subfeature 11 of
> social-selling; needs connect-whatsapp (2) and audience (5).

## What this feature is
When a shop connects WhatsApp while keeping its Business app (parent Q12), the people in that app's
contact book appear in the shop's Audience, marked Not yet. Adds and edits on the phone follow. When
a buyer writes YES in a chat with the shop, they are opted in; STOP, and they are out; each gets a
short confirming reply in the same chat.

## Why
A shop's customers are already in its WhatsApp contacts. Bringing them in shows the shop its real
reach, but having a number is not permission to market to it (parent Q9). The chat is where most
buyers will say yes or no, so the chat must be where consent changes, at once.

## Requirements
- R1 — On connect, the Business app's contacts arrive as Not yet, with their phone-book names;
  later adds, edits and removals follow without the shop doing anything (parent Q13, Q1).
- R2 — A contact removed on the phone leaves Audience only if it has no consent history and no
  conversation; otherwise it stays, marked removed from the phone (Q2).
- R3 — A synced name never replaces one the shop typed or uploaded (Q3).
- R4 — A buyer's YES in a chat with the shop opts them in for that shop on WhatsApp, from any
  number, known or new; STOP stops it. The words are audience's (Q4, Q7).
- R5 — Each YES or STOP gets one confirming reply in the chat, free, in the buyer's language;
  the change never waits on the reply (Q5, Q8).
- R6 — Only the buyer's own message counts: a reply the shop typed in its app never opts anyone
  in (Q6).
- R7 — The Audience page says whether the phone's contacts arrived, are still coming, or were not
  shared, and what to do (Q11).
- R8 — Nothing here is a marketing message; no synced contact is messaged until it opts in.

## Hazards the TRD must answer
- **Meta sends the same event twice**, or out of order (an edit before its add).
- **A large first sync** (thousands of contacts) arriving while the shop browses Audience.
- **A STOP inside a sentence** ("please stop sending blue ones") misread as an opt-out.
- **An echo of the shop's own "reply YES to join"** read as the buyer's YES.

## Product acceptance
Judged on a phone (~360px) first.
- A1 — After connecting the owner's own number, its Business app contacts appear in Audience as
  Not yet within minutes; a contact added on the phone appears without a refresh of anything else.
- A2 — YES from a buyer's phone shows them Opted in, source Chat, and they receive the confirming
  reply; STOP shows Stopped and its reply.
- A3 — The shop typing "Reply YES" in its app opts nobody in.
- A4 — Replaying the same webhook twice leaves one contact and one consent change.
- A5 — Every state in ux.md's matrix can be reached and reads as written.

## Scope
- **Outcome:** a shop's phone contacts are in its Audience, and chat YES and STOP work.
- **In:** R1–R8, tested by A1–A5.
- **Later:** chat history (parent Q10); messaging anyone (whatsapp-campaigns).

## Open questions
None.
