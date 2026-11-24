# Spec — social-selling/enquiry-autoreplies

- **Summary:** Every Instagram DM and WhatsApp chat gets an answer at once, whether or not anyone is at the shop: a greeting, an away message outside business hours, answers to the questions every shop gets, buttons to choose from, and a person whenever the buyer asks
- **Status:** Draft
- **Domain:** automations
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-22
- **References:** [decisions.md](decisions.md), parent [social-selling](../spec.md) and its [decisions](../decisions.md) (Q7, Q63, Q89), [inbox-core](../inbox-core/spec.md), [product-answers](../product-answers/spec.md), [store-policies](../../store-policies/spec.md), [INTEGRATIONS.md](../../../INTEGRATIONS.md#acting-for-a-shop-on-meta-catalogue-whatsapp-instagram)

> Requirements and product approach only. Technical approach lives in trd.md. Module: Converse.
> Platform-free: reacts to the inbox's "message arrived" and replies through the inbox.

## What this feature is
The shop's automatic replies, set up once on an Auto-replies page: when the shop is open and when
it is not, what to say first, and the answers to its common questions. Buyers get an answer in
seconds; the shop takes over whenever it wants.

## Why
A buyer who asks at 11pm and hears nothing by morning has bought elsewhere. Most first questions
are the same everywhere (delivery, cash on delivery, returns, where the shop is) and already have
answers in the shop's settings and policies (parent Q89).

## Requirements
- R1 — Off until the shop turns it on; turning it on shows each reply pre-filled, editable, in
  English and Hindi (Q1).
- R2 — The shop's hours are the one set kept on Messaging settings, per day of the week in IST; the
  Auto-replies tab of the Inbox's settings holds the replies themselves (parent Q110, Q112).
- R3 — A buyer's first message in a conversation gets a greeting, with buttons for the common
  questions and "Talk to the shop", after a delay the shop sets (default 30 seconds) while the chat
  shows "typing…"; a member replying within it cancels it. Outside business hours the greeting also
  says when the shop will reply. A tapped button is answered at once (Q2).
- R4 — Answers to common questions (delivery time and charges, cash on delivery, returns and
  exchanges, where the shop is, how to order) are drawn from the shop's own settings and store
  policies, never invented; a question with no answer in them is not offered (Q3).
- R5 — A buyer's message is matched to a common question by its words in English, Hindi or
  Hinglish, or by the button tapped; a message matching nothing is left for the shop (Q4).
- R6 — "Talk to the shop", or any message the replies cannot answer, hands the conversation to a
  person: it is marked Needs you at the top of the inbox, and the buyer is told when to expect an
  answer (parent Q89, Meta's rule that a buyer can always reach a person).
- R7 — When a member replies in a conversation, automatic replies pause in it for a set time, so the
  shop and the bot never talk over each other (Q5).
- R8 — On Instagram the shop's first-message buttons also appear as Instagram's starter questions
  (up to four) on its profile; on WhatsApp they are reply buttons or a list (Q6).
- R9 — Every automatic reply appears in the thread marked Automatic, is free (inside the window the
  buyer's message opened), and is never a marketing message.

## Hazards the TRD must answer
- **A loop:** an automatic reply triggering another, or two shops' bots answering each other.
- **A buyer typing fast:** five messages in a row answered five times.
- **A policy changed** after a reply was drafted from it.

## Product acceptance
Judged on a phone (~360px) first.
- A1 — At 11pm, with hours 10am–9pm, a buyer's "hi" on WhatsApp shows "typing…" and, 30 seconds
  later, the greeting, the away line and buttons; a member replying first cancels it.
- A2 — Tapping "Is COD available?" answers from the shop's own setting.
- A3 — "Talk to the shop" marks the conversation Needs you and tells the buyer when.
- A4 — After a member replies, the next buyer message gets no automatic reply for the paused time.
- A5 — The shop's Instagram profile shows its starter questions; tapping one gets its answer.
- A6 — A message about something the replies cannot answer is left for the shop, marked Needs you.

## Scope
- **Outcome:** no enquiry waits unanswered, and the shop takes over whenever it wants.
- **In:** R1–R9, tested by A1–A6.
- **Later:** AI wording (parent Q89, step 8); replies per platform that differ.

## Open questions
None.
