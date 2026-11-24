# Spec — social-selling/inbox-core

- **Summary:** One shared Inbox where a shop reads and answers every conversation, a tab per connected platform, knowing nothing of any platform: each platform plugs in its conversations and its rules, and automatic replies plug in on top
- **Status:** Draft
- **Domain:** inbox
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-22
- **References:** [decisions.md](decisions.md), parent [social-selling](../spec.md) and its [decisions](../decisions.md) (Q7, Q34, Q63, Q66, Q89), [inbox-instagram](../inbox-instagram/spec.md), [inbox-whatsapp](../inbox-whatsapp/spec.md), [notifications-core](../../notification-hub/notifications-core/spec.md)

> Requirements and product approach only. Technical approach lives in trd.md. Module: Converse.
> Built against a fake source; inbox-instagram and inbox-whatsapp are its first real ones.

## What this feature is
The Inbox page: a tab per connected platform, a list of conversations, a thread, and a reply box
that always says what can be sent right now. It is the shell; each platform's inbox fills its tab.

## Why
Shops lose sales to messages they never saw or saw too late, spread over two apps. One inbox,
shared by every member, makes every enquiry visible and answerable from the place the shop already
works (parent Q63).

## Requirements
- R1 — A tab per platform the shop has connected and whose inbox is built; each tab has an Unread
  filter. With nothing connected the Inbox says what will appear and links to Channels (parent Q63).
- R2 — A conversation is one thread with one person on one platform, or one comment with its
  replies; it shows the person's name or handle and, for a comment, its post (Q2).
- R3 — Every member sees every conversation; each reply shows which member sent it, to members only.
  A reply sent by an automatic reply is marked as such (parent Q63, Q89).
- R4 — Inbox is its own item in the shop menu, with the count of conversations needing the shop
  beside it (parent Q110). A conversation is unread until a member opens it (Q3).
- R4a — A conversation is Unread, Needs you (handed over by an automatic reply, or a question it
  could not answer) or Answered automatically; each is a filter, and Needs you always comes first
  (parent Q114).
- R5 — A member replies with text up to 1,000 characters and, optionally, one image from the
  library (Q5). What a member sends is held 7 seconds with Undo, which returns it to the box;
  nothing sent can be edited or deleted, as the platforms allow neither (Q16).
- R6 — The reply box always says what is possible now, from what the platform reports: reply
  freely; reply as a person for a few more days; or only a paid template, with its cost. It is never
  disabled; an action not possible explains itself on tap (Q7).
- R7 — Where the platform allows it, a member can act on a message from the thread (hide a comment,
  answer a comment privately, send a template); each platform declares which actions it has.
- R8 — Voice notes play in the thread. Anything that arrives which the inbox cannot show (a
  view-once photo, a poll) appears as a line naming what it was, never dropped (Q5).
- R9 — A failed send shows Not sent, the reason in plain words, and Try again; a temporary failure
  is retried once first (Q9).
- R10 — The inbox tells the rest of the platform only neutral things: a message arrived (for
  automatic replies), a conversation has waited four hours, a send failed (for notifications-core).
  It never chooses how anyone is told (parent Q66).
- R11 — Search finds a person by name or handle; there is no search of message text (Q3). The
  Inbox's settings hold the Auto-replies tab (parent Q110).
- R12 — Each shop sees only its own conversations; the same message delivered twice shows once.
- R13 — Messages are kept while the platform is connected and deleted 90 days after it is
  disconnected (parent Q34); the person's name and handle are kept, never a profile photo (Q15).
- R14 — Only the shop's members read its chats: message bodies are encrypted at rest with a key per
  shop, no staff screen shows one, and support sees a chat only when the shop shares it for one
  request, for 48 hours, shown to the shop under "Who has opened your chats" (parent Q116).

## Hazards the TRD must answer
- **Two members replying at once** to the same conversation.
- **A source that delivers late or out of order**, so a thread reads in the wrong order.
- **The 7-second hold** surviving a closed tab, and an Undo racing the send.
- **A busy shop's inbox** (thousands of threads) staying fast on a phone.

## Product acceptance
Judged on a phone (~360px) first.
- A1 — With the fake source, a message arrives in its tab as unread, the menu count rises, opening it
  clears it for every member.
- A2 — A reply sent by one member shows their name to the other members.
- A3 — The reply box shows each of the three states the source reports, with the right wording.
- A4 — A voice note plays in the thread; a view-once photo arrives as its named line.
- A5 — A failed send shows its reason and Try again, and succeeds on retry.
- A6 — A conversation unanswered for four hours produces one "waiting" event.

- A7 — No admin page or read model returns a message body; a chat shared with support for a request
  opens for 48 hours only and appears in the shop's "Who has opened your chats".
- A8 — Send then Undo within 7 seconds puts the text back in the box and nothing reaches the
  buyer; without Undo it reaches the buyer after 7 seconds, even if the tab was closed.

## Scope
- **Outcome:** a shop reads and answers its conversations in one shared inbox.
- **In:** R1–R14, tested by A1–A8.
- **Later:** assigning conversations (parent Q63); search of message text (Q3).

## Open questions
None.
