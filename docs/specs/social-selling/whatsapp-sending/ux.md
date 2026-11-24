# UX — social-selling/whatsapp-sending

- **Status:** Signed off 2026-11-23
- **Verified:** 2026-11-22
- **Prototype:** [prototypes/reach.html](../prototypes/reach.html), sections "Messaging settings", "Templates"; the spending-limit step in [connect.html](../prototypes/connect.html)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux-patterns](../ux-patterns.md) §7, parent Q8, Q40, Q112, [connect-whatsapp ux](../connect-whatsapp/ux.md)

> Money and rules, kept small. A shop sets two things, its monthly limit and its hours, and sees
> this month's spend against the limit; everything else works from defaults under Advanced.
> Templates are Meta's, so their screen translates Meta's verdicts into plain words and shows what
> each costs.

## Journeys
1. **Set the limit at connect.** See connect-whatsapp; the same sheet.
2. **Check spend.** Shop details → **Messaging** → top card: "₹212 of ₹1,000 this month" with a
   bar, "about 916 marketing messages left" → **Change limit** (sheet with the same chips) → toast
   "Limit saved."
3. **Hit the limit.** A campaign or alert would cross it → held; the shop gets one notice "Messages
   paused: this month's ₹1,000 limit is reached. 64 held." → Messaging → **Raise limit** → sheet
   ends with "Send the 64 held messages now? · about ₹55" **Send held** / **Not now**.
4. **Shop hours.** "Shop hours · Mon–Sat 10 am–9 pm" → **Edit** → a row per day with open/close or
   Closed, **Same every day** shortcut → saved as edited. One line under: "Used by automatic
   replies, and alerts only go out in these hours."
5. **Advanced.** Folded, each with its default and a reset: "How often a buyer may get offers ·
   once a day, 4 a week" (with "Messaging more often risks WhatsApp lowering your number's
   quality."), greeting delay, bot pause after you reply, alerts per product.
6. **Templates.** Messaging → **Message templates · 12 approved** → list grouped by purpose, each
   with status and price → a starter one → **Copy and edit** → editor: name, language tabs EN/HI,
   text with blanks as chips (**Customer name**, **Product**, **Price**, **Shop name**), up to 3
   buttons, live preview as a WhatsApp bubble with sample values → **Submit to WhatsApp** (pending
   "Submitting…") → In review → approved usually within a day, notified.
7. **A rejected template.** Row "Rejected · WhatsApp says it reads like a promotion but is marked
   as an update." → **Edit and resubmit**.

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Messaging settings | `/org/[orgId]/shop/details/messaging` (Shop details section) | New | R2, R3, R8, R9 |
| Limit sheet | `HandoffSheet` (shared with connect-whatsapp) | New | R2, R3 |
| Hours editor | Sheet on a phone, inline from `md:` | New | R8 |
| Templates list | `/org/[orgId]/shop/details/messaging/templates` | New | R5–R7 |
| Template editor | `/templates/new`, `/templates/[id]`; full page on a phone, `TaskDialog` from `lg:` with preview beside | New | R6 |

## State matrix — Messaging settings
| State | What the shop sees | Action |
|---|---|---|
| First use (no limit set) | Amber card "Set a monthly limit before sending offers." | Set limit |
| Not connected | "Connect WhatsApp to send messages." The hours still editable (Instagram replies use them) | Connect |
| Loading | Card skeletons | — |
| Success | Spend card, hours, quality "Quality: High", Advanced folded, Templates line | — |
| Near the limit (80%) | Bar amber, "₹820 of ₹1,000 · about 209 left" | Change limit |
| At the limit | Bar red, "Limit reached · 64 messages held" | Raise limit |
| No limit | "₹212 this month · No limit" | Set a limit |
| Quality Medium / Low | "Quality: Low. WhatsApp may limit your offers. Fewer, wanted messages raise it." | Why? |
| Retryable error | Save failed inline per field | Try again |
| Refused | Limit under ₹100: "The lowest limit is ₹100." · closing before opening | — |
| Phone / tablet / desktop | One column; spend card first | — |

## State matrix — Templates
| State | What the shop sees | Action |
|---|---|---|
| First use | Starter templates arriving: "Submitting 12 starter templates to WhatsApp · 8 of 12" | — |
| Statuses | In review · Approved · Rejected (with why) · Paused (WhatsApp saw too many blocks) · Disabled | Per row |
| Price | Each row "about ₹0.86 · offer" or "about ₹0.12 · update" | — |
| Editor refused | Over 1,024 characters; a blank at the very start or end ("WhatsApp doesn't allow a blank at the start or end"); more than 3 buttons | — |
| Editor slow | Submitting past 3 s: "Still submitting…" | — |
| Archived | Folded "Archived · 2" at the foot | Restore |

## Copy deck
- "Messaging", "₹<n> of ₹<limit> this month", "about <n> marketing messages left", "Change limit", "Raise limit", "Send held", "Not now".
- "Messages paused: this month's ₹<limit> limit is reached. <n> held."
- "Shop hours", "Same every day", "Closed", "Used by automatic replies, and alerts only go out in these hours."
- Advanced: "How often a buyer may get offers", "Messaging more often risks WhatsApp lowering your number's quality.", "Reset to default".
- Templates: "Message templates", "Copy and edit", "Submit to WhatsApp" → "Submitting…", statuses as above, "Edit and resubmit".

## Sign-off
Signed off by the owner on 2026-11-23, after the senior UX review ([ux-review](../ux-review.md)) and the final cross-feature check.
