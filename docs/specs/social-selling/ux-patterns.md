# UX patterns — social-selling

- **Verified:** 2026-11-22
- **Covers:** every ux.md of social-selling, its siblings (notification-hub, bulk-publish, checkout-links) and ai-images/social-posts
- **References:** [spec.md](spec.md) (Q8, Q110–Q114), [src/components/CLAUDE.md](../../../src/components/CLAUDE.md), [ADR-0013](../../adr/0013-one-error-envelope-and-useserverform.md), [ADR-0015](../../adr/0015-mobile-first-design.md), [ADR-0040](../../adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md), [ADR-0050](../../adr/0050-three-form-factors-on-tailwinds-own-breakpoints.md), [ADR-0053](../../adr/0053-readiness-advises-and-never-gates.md), [ADR-0066](../../adr/0066-the-ui-is-built-in-tiers-and-every-icon-goes-through-one-seam.md), [ADR-0067](../../adr/0067-words-live-in-copy-modules-and-our-own-paths-in-one-routes-table.md)

> The rules every screen in this feature follows, written once so each module's ux.md states only
> what is its own. A module's ux.md that departs from one says so and why. Built from the app's
> existing primitives and page grammar; nothing here is a new component unless it says so.

## 1. Where things live (Q110)
| Menu item | Holds | Opened from |
|---|---|---|
| **Channels** (exists) | Instagram and WhatsApp cards: connect, health, setup checklist | Menu; every "Connect" link |
| **Inbox** (new, with its Needs you count) | Tabs per platform; filters Needs you · Unread · Answered automatically; settings → Auto-replies tab | Menu; Home card; notifications |
| **Posts** (new) | Scheduled · Published · Failed; the composer | Menu; Home card; checklist "First post" |
| **Customers** (new) | Audience tab, Campaigns tab | Menu; Home card |
| **Shop details** (exists) | Messaging settings (spending limit, shop hours, Advanced) · Notification settings | Menu; checklist "Spending limit"; links from any cost line |

Phone: these sit in the portal's existing menu sheet; Inbox also takes a tab-bar slot when the
shop has social selling on, since it is used daily. Tablet and desktop: the sidebar, in that order
under a "Social" group, after Channels.

## 2. Every page uses the existing page grammar
`PageHeader` (the one h1 and the "?" hint) · `ActionBar` for the page's primary action · `PageTabs`
for tabs that are routes · `ResourceList` for any list (rows on a phone, a table from `md:`) ·
`StatusBadge` for every status · `EmptyState` / `ErrorState` with one action · skeletons, never a
page spinner · `SelectionBar` for bulk actions · overlays chosen by what they hold (ADR-0040): a
picker is `ResponsivePicker`, a task like composing is `TaskDialog` on desktop and a full page on a
phone, a short confirmation or handoff is `HandoffSheet`.

## 3. A button always says what it is doing
| Moment | What the shop sees |
|---|---|
| Ready | The verb: **Connect WhatsApp**, **Schedule**, **Send to 104** |
| Tapped | `Button pending`: the same button, a spinner and the verb in progress (**Connecting…**, **Scheduling…**, **Sending…**); never disabled, a second tap joins the first |
| Over 3 seconds | A quiet line under it: "Still working…" |
| Over 30 seconds | "This is taking longer than usual. It may still finish; we'll show it here." The result arrives in place when it lands |
| Done | The control changes to its new state in place (card turns Connected, row turns Scheduled), and a toast names what happened in the past tense: "WhatsApp connected." |
| Failed | The control returns to Ready; an inline note under it says what went wrong and what to do, with **Try again** when trying again can help. Never a bare "Something went wrong" |
| Not possible now | The button stays tappable and explains on tap (ADR-0053): "Connect Instagram first", with the action that fixes it |

## 4. Long work runs on its own, and shows where it is
Anything that takes more than a few seconds (settling a catalogue, bulk publishing, sending a
campaign, syncing) runs in the background. The screen shows a progress line with counts ("Sending
· 64 of 104"), can be left, and shows the same progress on return. Finishing raises a toast if the
shop is there and a badge item if not. A failure part-way keeps what was done and offers to resume.

## 5. Nothing the shop typed is lost, and back goes back
Drafts save as they are typed: a post, a campaign, a template, auto-replies, a settle in progress.
Leaving and returning finds them as left, with "Draft saved · 2 min ago". Tabs, filters and search
live in the URL, so refresh and back keep them. A step opened from elsewhere (a checklist, a Home
card, a notification) returns there when done, with the step's change already shown.

## 6. Setting up a connection is a checklist on its card (Q111)
The channel card, until setup is done, shows its steps as a short list: done steps ticked and dim,
the next step bold with its own button as the card's main action, later steps listed. Each step
opens its screen and returns to the card. A step that needs waiting ("Templates · in review") says
so and needs no tap. When all are ticked the list folds into "Setup done" and the card shows health.

## 7. Money is shown before it is spent
Every paid action shows its cost before the tap that spends it, in rupees, with what it counts
against: "₹0.86 each · about ₹90 · this month ₹412 of ₹1,000". The confirming tap names the amount
("Send to 104 · ₹90"). Free actions never show a price. AI pictures show their credit cost on the
Generate button, as ai-images already does.

## 8. A locked feature shows itself, with its lock (Q8)
Without the Social selling lock, the screens are still there, with the plan banner on top and a
lock on each paid action that opens the plan sheet (`LockedAction`, feature-access Q20, Q29).

## 9. Words
Plain words a shop owner uses: *connected*, *needs reconnecting*, *spending limit*, *how often*,
*Needs you*, *answered automatically*. Never Meta's terms (WABA, template category, BSUID, webhook).
Buttons are verbs; toasts are past tense; errors say what to do next. Every string ships from the
area's copy module (ADR-0067). Shop-facing words are English; buyer-facing messages come in English
and Hindi (parent Q37).

## 10. Form factors (ADR-0050)
Phone first at ~360px: one column, actions full width at the bottom of a card or in the
`ActionBar`, targets at least 40px, nothing on hover only. Tablet (`md:`): two cards across,
lists become tables, the composer and inbox thread split into list and detail. Desktop (`lg:`):
three cards across, the inbox shows list, thread and the buyer's details side by side.

## 11. States every screen answers
Each ux.md fills the state matrix of the SDLC: first use, empty, loading, partial, success,
retryable error, terminal error, refused, stale, long content, many items, slow, and form factors.
Where a row cannot happen it says "n/a" and why. Loading is a skeleton in the final layout; slow
adds "Still working…" after 3 seconds; stale shows "Updated <time>" with a refresh.
