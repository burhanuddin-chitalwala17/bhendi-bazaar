# TRD — social-selling/enquiry-autoreplies

- **Status:** Accepted
- **Domain:** automations
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-23
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](ux.md), the architecture [TRD](../trd.md), [inbox-core TRD](../inbox-core/trd.md), [whatsapp-sending TRD](../whatsapp-sending/trd.md) (shop hours), store-policies (answers' sources)

> Technical approach and decisions. No code — references to existing code only, to justify a
> decision.

## Approach
A sink on `InboundMessage`, ordered after inbox's, that decides one of: greet (first message, after
the delay), answer (a tapped button or a keyword match), hand over (Talk to the shop, or nothing
matched), or stay quiet (off, paused by a member, already answered). Answers are rendered from the
shop's live settings at send time, never stored copies.

## Prior art
- **Rule-based FAQ bots with human handover** (WhatsApp Business app's greeting and away messages,
  Freshchat's FAQ bot): keyword or button triggers, a human handover that marks the thread, a quiet
  period after a person replies. Followed; Meta requires that a person can always be reached.

## Technical decisions
- **D1 — Settings.** `AutoReplySettings(orgId PK, enabled, greeting {en, hi}, delaySeconds
  (0|30|60), pauseHours (default 12, Q5), parts JSON (each question: enabled, keywords, wording
  override), starterQuestions (≤4), version)`. Shop hours are read from whatsapp-sending's Messaging
  settings (Q112), never copied.
- **D2 — Decision (R3–R7).** Pure `decide(message, conversation, settings, now)` → `GREET |
  ANSWER(questionId) | HANDOVER(reason) | QUIET(reason)`, table-tested. Quiet when disabled, when
  `botPausedUntil > now`, or for an echo or our own send.
- **D3 — Greeting with delay (R3, Q2).** GREET writes an `AutoReplyPending(conversationId PK,
  dueAt, version)` and enqueues `automations.greet` with `startAfter = dueAt`, after sending a
  typing indicator (WhatsApp: mark read with typing; Instagram: `typing_on`). A member's send in the
  window deletes the pending row (inbox-core's `botPausedUntil` also blocks it); the job sends only
  if its row and version still exist. Outside shop hours the greeting appends the away line. A
  tapped button answers at once.
- **D4 — Answers from live settings (R4, Q3).** Each question's answer is a function over the source
  it reads (shipping settings, payments' COD, store policies, the shop's address) through their
  public surfaces; a question whose source is empty is not offered and shows "Add your … to answer
  this" in settings.
- **D5 — Matching (R5, Q4).** Keywords per question in English, Hindi (Devanagari) and Hinglish,
  defaults in code (`automations/keywords.ts`), shop-editable; matching uses comment-automations'
  normaliser and whole-token match; no AI.
- **D6 — Handover (R6).** `inboxService.markNeedsYou(conversationId, reason)` and the handover reply
  ("…as soon as they can", or "from <time>" outside hours).
- **D7 — Buttons (R8, Q6).** WhatsApp: interactive reply buttons (≤3) or a list; Instagram: quick
  replies in the DM and ice breakers set on the profile when settings change
  (`channels.ig-ice-breakers` job).
- **D8 — Try it.** A route that runs `decide` and renders replies for a typed message without
  sending, for the settings page's pretend chat.

## Packages
None.

## UI approach
ux.md's Auto-replies tab (`/inbox/settings?tab=auto-replies`): server-rendered with a live preview
leaf; autosave per field with versioned saves; the Try it sheet. Words in `automations-copy.ts`.

## Gates touched
Routes settings save, try-it; `MAY_USE_SHEET` (Try it).

## Data model
[MIGRATION] `AutoReplySettings`, `AutoReplyPending`.

## API / contract changes
Reads whatsapp-sending's hours and the policy sources through public surfaces.

## Test plan
- `decide` table (unit, 100% branches).
- Greeting cancelled by a member's reply in the delay (A1); away line at 11 pm.
- COD answer from the live setting (A2); handover marks Needs you (A3, A6); pause respected (A4).
- Ice breakers set on the profile (A5) against the fake source.

## Delivery
1. Settings, `decide`, sink (behaviour).
2. Delayed greeting with typing; answers; handover.
3. Settings tab and Try it (UI); ice breakers.

## Open questions
None.
