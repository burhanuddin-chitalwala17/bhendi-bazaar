# UX — social-selling/enquiry-autoreplies

- **Status:** Signed off 2026-11-23
- **Verified:** 2026-11-22
- **Prototype:** [prototypes/converse.html](../prototypes/converse.html), sections "Auto-replies", "What a buyer sees"
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [inbox-core ux](../inbox-core/ux.md), [whatsapp-sending ux](../whatsapp-sending/ux.md) (shop hours), parent Q112

> Turning automatic replies on should take one tap and a look: everything is pre-filled from what
> the shop already told us (delivery, COD, returns, address), shown as the buyer will see it. A
> question the shop's settings can't answer isn't offered, with a link to add the setting.

## Journeys
1. **Turn it on.** WhatsApp card checklist **Auto-replies**, or Inbox → ⚙ → **Auto-replies** →
   one screen: a switch **Automatic replies** (off) above a live preview of the greeting as a chat
   bubble with its buttons → **Turn on** (pending "Turning on…") → toast "Automatic replies are
   on." → back to the checklist, ticked.
2. **Adjust the greeting.** **Greeting** → text (English / Hindi tabs, both pre-filled), wait chips
   **Right away · 30 s · 1 min** (30 s picked) with the line "Buyers see "typing…" while it
   waits. If you reply first, it isn't sent." → saves as typed.
3. **Common questions.** List of five with switch and source: "Delivery · from your Shipping
   settings", "Cash on delivery · from Payments", "Returns · from your Return policy", "Where we are
   · from your address", "How to order". One without a source reads "Add your return policy to
   answer this" with **Add** (opens the setting, returns here). Tap a question to edit its words.
4. **Shop hours and away.** Line "Shop hours: Mon–Sat 10 am–9 pm · Edit in Messaging" and the away
   line preview "We're closed now and reply from 10 am."
5. **When you step in.** Chips **30 min · 2 h · 12 h**: "After you reply, automatic replies wait
   this long in that chat."
6. **Instagram starter questions.** With Instagram connected: "Show on your Instagram profile" with
   up to four of the questions picked → appears on the profile's message screen.
7. **One switch, parts inside.** The top switch turns every automatic reply on or off. Inside,
   each part (greeting, each common question, product answers, comments on any post) has its own
   switch, on by default, so a shop can drop one without losing the rest.
8. **See it as a buyer.** **Try it** opens a sheet with a fake chat: type "hi" or tap a button and
   watch the replies, nothing sent.

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Auto-replies tab | `/org/[orgId]/inbox/settings?tab=auto-replies` | New | R1–R8 |
| Try it | `HandoffSheet` chat simulation | New | R1 |
| Automatic bubbles and handover line | Thread | New (via inbox-core) | R6, R9 |

## State matrix — Auto-replies tab
| State | What the shop sees | Action |
|---|---|---|
| First use | Off; preview of the pre-filled greeting; "Everything below is filled in from your settings. Change anything, then turn it on." | Turn on |
| Loading | Sections as skeletons, switch drawn | — |
| Partial | Some questions have no source: "Add your return policy to answer this" | Add |
| Success | On; "Answered 34 messages this week · 6 handed to you" | — |
| Retryable error | Save failed inline: "Couldn't save. Try again." beside the field | Try again |
| Refused | Greeting over 1,024 characters; more than 4 starter questions | — |
| Stale | A setting it reads changed (COD turned off): the question updates itself and says "Updated from Payments · today" | — |
| Not connected | "Connect Instagram or WhatsApp to answer automatically." | Connect |
| Phone / tablet / desktop | One column; preview at the top on a phone, beside the settings from `lg:` | — |

## What a buyer sees (WhatsApp)
"typing…" (30 s) → "Hi Ayesha! Welcome to Niqab Boutique 🌙 How can we help?" with reply buttons
**Delivery** · **Cash on delivery** · **Talk to the shop** (WhatsApp shows up to three buttons;
more become a list "See all questions") → outside hours a second line "We're closed now and reply
from 10 am." → "Talk to the shop" answers "Thanks! Someone from the shop will reply as soon as they can." (outside
hours: "…will reply from 10 am.") and the conversation turns Needs you. It never promises a time
the shop hasn't set.

## Copy deck
- "Automatic replies", "Turn on" → "Turning on…", toast "Automatic replies are on." / "…are off."
- "Greeting", "Right away", "30 s", "1 min", "Buyers see "typing…" while it waits. If you reply first, it isn't sent."
- Default greeting "Hi <name>! Welcome to <shop> 🌙 How can we help?"; Hindi "नमस्ते <name>! <shop> में आपका स्वागत है 🌙 हम आपकी कैसे मदद करें?"
- Questions "Delivery", "Cash on delivery", "Returns", "Where we are", "How to order"; "from your <setting>"; "Add your <setting> to answer this".
- "Talk to the shop" → "Thanks! Someone from the shop will reply as soon as they can." / "…will reply from <time>."
- Away "We're closed now and reply from <time>."
- "After you reply, automatic replies wait this long in that chat."
- "Show on your Instagram profile", "Up to 4 questions.", "Try it".

## Sign-off
Signed off by the owner on 2026-11-23, after the senior UX review ([ux-review](../ux-review.md)) and the final cross-feature check.
