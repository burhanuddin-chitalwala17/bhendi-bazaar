# UX — social-selling/social-home

- **Status:** Signed off 2026-11-23
- **Verified:** 2026-11-22
- **Prototype:** [prototypes/home.html](../prototypes/home.html)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), parent Q111, Q113, [ux-patterns](../ux-patterns.md)

> One card on the shop's Home that answers "is selling on Instagram and WhatsApp working, and does
> anything need me?" in a glance, and one overview for the platform owner that shows trouble before
> shops report it. Every figure is a door: tapping it opens the screen behind it, filtered.

## Journeys
1. **Morning glance (A1).** Home → card **Social selling**: first line, amber when non-zero, "2
   messages need you" → tap → Inbox on Needs you. Below, quiet figures: "34 answered automatically
   this week", "3 posts this week · next today 6 pm", "₹212 of ₹1,000 on WhatsApp this month".
2. **Mid-setup (A2).** The card leads with the next step: "Next: settle your WhatsApp catalogue ·
   40 items" with **Settle catalogue**, and "2 of 5 steps done".
3. **Something broke.** "Instagram needs reconnecting. Posts won't publish until it is." with
   **Reconnect** leads the card, above everything.
4. **No plan.** The card shows what social selling does (three lines) and the lock sheet with **Talk to us**.
5. **The owner (A3).** Admin → Channels → **Social** overview: per platform a row with shops
   connected, needing attention (a link to the list), Meta's onboarding limit "7 of 10 this week",
   events failing "0 in the last day" → a shop needing attention → its connection detail.

## Card order (most urgent first)
1. A connection needing the shop (red/amber). 2. Messages needing it. 3. The next setup step,
while setup is open. 4. Figures: answered automatically, posts (with "3 posts waiting for Instagram · Connect" while saved posts wait), spend. A figure at zero is left
out (R3); a card with nothing at all shows only the next step or "All good".

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Social selling card | Shop Home, after the orders card | New | R1–R4 |
| Social overview | Admin channels page, a section | New | R5 |

## State matrix — Home card
| State | What the shop sees | Action |
|---|---|---|
| First use (nothing connected) | "Sell on Instagram and WhatsApp" · "Connect to post, answer every message here, and send offers." | Connect |
| Setup open | Next step and "2 of 5 steps done" | The step |
| Needs attention | The problem line first | Fix |
| Success | Figures, each a link | Open |
| All quiet | "All good · nothing needs you" plus posts and spend | — |
| Loading | Card skeleton, two lines | — |
| Partial | A figure whose owner fails to answer is left out, never shown as 0 | — |
| Refused | No plan: lock | Talk to us |
| Phone / tablet / desktop | Full-width card on a phone; half width from `lg:` | — |

## State matrix — Admin overview
| State | What the owner sees | Action |
|---|---|---|
| Empty | "No shops connected yet." | — |
| Success | Row per platform: connected, needing attention, onboarding limit, failing events | Open |
| Limit near | "9 of 10 this week" amber | — |
| Events failing | "12 failing in the last day" red | See events |
| Loading | Row skeletons | — |

## Copy deck
- Title "Social selling"; "<n> messages need you", "<n> answered automatically this week", "<n> posts this week · next <when>", "₹<used> of ₹<limit> on WhatsApp this month", "Next: <step>", "<n> of <m> steps done", "All good · nothing needs you".
- Locked: "Sell on Instagram and WhatsApp" · "Post, answer every message here, and send offers to customers who asked." · "Talk to us" (the lock sheet, feature-access).
- Admin: "Social", "Shops connected", "Needing attention", "Meta's onboarding limit", "<n> of <m> this week", "Events failing", "<n> in the last day".

## Sign-off
Signed off by the owner on 2026-11-23, after the senior UX review ([ux-review](../ux-review.md)) and the final cross-feature check.
