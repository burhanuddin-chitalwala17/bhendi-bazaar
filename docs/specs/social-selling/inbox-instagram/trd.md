# TRD — social-selling/inbox-instagram

- **Status:** Accepted
- **Domain:** channels (Instagram's `ConversationSource` and translator)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-23
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](ux.md), the architecture [TRD](../trd.md) (A-D6, D7, D11), [inbox-core TRD](../inbox-core/trd.md), [INTEGRATIONS.md](../../../INTEGRATIONS.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
Instagram's half of the inbox: the translator turns `messages`, `comments`, reactions, edits and
seen events into neutral facts; the source sends DMs, public and private comment replies and hides;
a reconciliation re-reads conversations because Instagram's webhooks are known to miss messages.

## Prior art
- INTEGRATIONS "What an inbox receives and may do" (checked 2026-11-21): fields, the human-agent
  tag, one private reply per comment within 7 days, no GIF/sticker webhooks, missed webhooks. This
  TRD follows it.

## Technical decisions
- **D1 — Threads (R1, R2, Q2).** DM `threadKey` = the Instagram-scoped user id; a comment thread's
  = the top-level comment id, with `postRef` = media id and a cached thumbnail URL refreshed on
  read. Story replies and mentions are `InboundMessage` with a `storyRef` attachment rendered as the
  first bubble. Comments arrive for public accounts only; a `account_type` / privacy flag from the
  health read shows the tab note (R2).
- **D2 — Echoes (R6).** `is_echo` messages not matching one of our `platformMessageId`s are
  `OutboundEcho` → author `APP` ("From the app").
- **D3 — Sending (R3, R4).** DM: Send API with `HUMAN_AGENT` tag when the window is in days 2–7.
  Public reply: `/{comment}/replies`. Private reply: Send API `recipient.comment_id`; one per
  comment, recorded on the comment thread (`privateReplySentAt`, a unique guard) so the second is
  refused before calling (A4). The resulting DM thread links back ("Answered by DM").
- **D4 — Hide (R5).** `POST /{comment}?hide=true|false` through the source's declared action;
  state stored on the message.
- **D5 — Reconciliation (R7, A-D11).** `channels.ig-reconcile(connectionId)` every 15 min while the
  account had activity in 7 days: lists conversations updated since the cursor and their latest
  messages, emitting synthetic events with Meta's own `mid` as dedupe key, so a recovered message
  is stored once (A6).
- **D6 — Message access off (R8).** A send or read answering the "messaging not allowed" code sets
  connect-instagram's `MESSAGES_OFF` health; the tab shows the note.
- **D7 — Disconnect (R9, Q9).** As inbox-core D10; reconnecting the same account clears the clock.

## Packages
None.

## UI approach
ux.md's Instagram tab, comment thread (post on top, Public / Private switch, ⋯ Hide), story reply
bubble and tab notes, as inbox components given the source's declared actions. Words in
`inbox-copy.ts`.

## Gates touched
None beyond inbox-core's routes (actions are a parameter of the action route).

## Data model
Conversation `postRef`, `privateReplySentAt`; message `hidden`.

## API / contract changes
None beyond `ConversationSource`.

## Test plan
- Translator on recorded payloads: DM, story reply with story, mention, comment, reply, reaction,
  edit, echo (A1).
- Human-agent tagging by window (A3); private reply once (A4); hide round trip (A5).
- Reconcile dedupes against a webhook-delivered copy (A6).

## Delivery
1. Translator and sinks wiring (behaviour: Instagram messages and comments land).
2. Source: DM, replies, hide.
3. Reconcile, access-off note.

## Open questions
None.
