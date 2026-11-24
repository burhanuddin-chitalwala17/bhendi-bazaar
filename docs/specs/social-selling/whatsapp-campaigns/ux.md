# UX — social-selling/whatsapp-campaigns

- **Status:** Draft
- **Verified:** 2026-11-22
- **Prototype:** [prototypes/reach.html](../prototypes/reach.html), sections "Campaigns", "New campaign", "Before you send", "Report"
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux-patterns](../ux-patterns.md) §4, §7, [audience ux](../audience/ux.md), [whatsapp-sending ux](../whatsapp-sending/ux.md)

> A campaign costs real money, so its one rule is that the shop knows exactly who gets it and what
> it costs before anything is sent, and the button says it: **Send to 104 · about ₹90**. Like the
> post composer it is one page, not a wizard.

## Journeys
1. **Send one (A1).** Customers → **Campaigns** → **New campaign** → one page: **Message** (pick an
   approved template; its blanks filled with chips; WhatsApp preview live) → **Products** (optional,
   1 or up to 30 from the catalogue) → **Who** (a list; count "120 in this list") → **When** (Now /
   pick a time) → **Review** → sheet: "104 will get it · 16 skipped: 9 not opted in, 4 stopped, 3
   messaged too often this week" · "about ₹0.86 each · about ₹90 in all" · "₹212 of ₹1,000 used this
   month" → **Send to 104 · about ₹90** (pending "Starting…") → report page, progress "Sending · 64
   of 104".
2. **Schedule (A2).** When: Fri 7 pm → button **Schedule for Fri 7 pm** → listed Scheduled; at 7 pm
   it recounts and never sends to more than 104; the report says "98 sent (6 fewer than confirmed:
   they stopped or were messaged since)".
3. **Stop (A3).** Report while sending → **Stop sending** → sheet "Stop now? 40 not yet sent won't
   be sent or charged." → **Stop** → "Stopped · 64 sent · 40 not sent".
4. **Over the limit.** Review shows "This would pass your ₹1,000 limit by ₹42. 49 would be held."
   with **Raise limit** beside **Send to 104**.
5. **Read the report (A4).** Figures: Sent 104 · Delivered 101 · Read 77 · Failed 3 · Skipped 16;
   actual cost ₹88.40; button taps "Shop now · 23"; each opens the people behind it with reasons.
6. **Late after an outage.** "This campaign was due at 7 pm but couldn't go. Send it now or cancel?"
   **Send now** / **Cancel** (only when over six hours late, R5).

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Campaigns tab | `/org/[orgId]/customers?tab=campaigns`, chips Drafts · Scheduled · Sent | New | R1, R7 |
| Campaign editor | `/customers/campaigns/new`, `/[id]/edit`; full page on a phone, `TaskDialog` from `lg:` | New | R1, R3, R4 |
| Review sheet | `HandoffSheet` | New | R2 |
| Report | `/customers/campaigns/[id]` | New | R5, R6 |

## State matrix — Editor and review
| State | What the shop sees | Action |
|---|---|---|
| First use, no templates approved | "Your templates are still in review with WhatsApp. Campaigns open when one is approved." | See templates |
| First use, no opted-in list | "No one can get offers yet. Grow your list first." | Go to Audience |
| Not connected / no limit set | Explains on Review tap, with Connect / Set limit | — |
| Partial | Draft saved | — |
| Refused | Blank unfilled: marked; a past time; over 30 products | — |
| Counting | Review sheet "Counting who gets it…" | — |
| Ready | Counts, cost, limit line | Send to <n> · about ₹<n> |
| Over the limit | Line and Raise limit | — |
| Sending started | Report page | — |
| Retryable error | "Couldn't start. Nothing was sent." | Try again |
| Phone / tablet / desktop | Phone: one column, preview as a sheet. Desktop: form left, preview right | — |

## State matrix — Report
| State | What the shop sees | Action |
|---|---|---|
| Scheduled | "Goes Fri 7:00 pm to about 104" | Edit · Cancel |
| Sending | Progress "Sending · 64 of 104"; leave and come back | Stop sending |
| Stopped | "Stopped by Farida · 64 sent · 40 not sent" | Duplicate |
| Sent | Figures, cost, taps, per-figure people | — |
| Late | The late question (journey 6) | Send now · Cancel |
| Many failures | "Failed 30 · most: number not on WhatsApp" | See who |

## Copy deck
- "Campaigns", "New campaign", sections "Message", "Products", "Who", "When", "Review".
- Review "<n> will get it", "<n> skipped: <n> not opted in, <n> stopped, <n> messaged too often this week", "about ₹<x> each · about ₹<y> in all", "₹<used> of ₹<limit> used this month".
- Buttons "Send to <n> · about ₹<y>" → "Starting…", "Schedule for <when>", "Stop sending", "Stop", "Send now", "Cancel campaign".
- Report "Sent", "Delivered", "Read", "Failed", "Skipped", "Cost", "Button taps".

## Sign-off
Not yet signed off. Awaiting the owner's review with the senior UX review.
