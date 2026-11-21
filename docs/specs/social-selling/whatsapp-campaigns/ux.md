# UX — social-selling/whatsapp-campaigns

- **Status:** Draft
- **Verified:** 2026-11-06
- **Prototype:** [prototype.html](prototype.html) (journeys 3–5; journeys 1–2 are whatsapp-templates'. Local file: publishing as a private artifact needs a claude.ai login in this session)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [whatsapp-templates ux](../whatsapp-templates/ux.md), [src/components/CLAUDE.md](../../../../src/components/CLAUDE.md), [ADR-0050](../../../adr/0050-three-form-factors-on-tailwinds-own-breakpoints.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md), [ADR-0040](../../../adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md)

> Phone first (~360px). Buttons are never disabled; an action that cannot happen explains itself on
> tap. Every string below is the string that ships. Money shows in rupees to the paisa.

## Journeys
Each starts on the screen the person was on just before.
1. **Send a campaign.** WhatsApp → Campaigns → New campaign → 1 Message (template, values) →
   2 Products (optional, up to 30) → 3 Who and when (list, time or now) → 4 Review (counts, skips,
   cost, this month's spend) → Schedule or Send now → campaign page.
2. **Watch and stop.** Campaign page while sending: "Sending · 64 of 121" → Stop sending → dialog →
   Stopped; unsent not charged.
3. **Read the report.** Campaigns list → a sent campaign → sent, delivered, read, taps, not
   delivered with reasons, skipped with reasons, cost.
4. **Held.** A scheduled campaign meets a paused template, a late start or the spend limit → its page
   says Held and why → Pick another template / Send now / Raise limit / Cancel.
5. **Set limits.** WhatsApp → Settings → number health, per-customer limit, monthly spend limit
   (first set while connecting WhatsApp) → Save. The alerts' sending window is on Notifications.

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Campaigns list | `/org/[orgId]/whatsapp/campaigns` | New | R8, R10 |
| Composer (four steps) | `/org/[orgId]/whatsapp/campaigns/new` | New | R1, R2, R5, R6, R11 |
| Campaign page (sending, report, held) | `/org/[orgId]/whatsapp/campaigns/[id]` | New | R7–R10 |
| Stop dialog | Over the campaign page | New | R8 |
| WhatsApp settings | `/org/[orgId]/whatsapp/settings` | New | R5, R6, R13 |

## State matrix — Campaigns list
| State | What the person sees | Action |
|---|---|---|
| First use (not connected) | "Send offers and new arrivals to customers who asked for them. Connect WhatsApp to start." | Connect WhatsApp |
| Empty | "No campaigns yet. Your first one takes about two minutes." | New campaign |
| Loading | Four row skeletons | — |
| Partial | Rows: Scheduled (time), Sending (x of y), Sent (date, delivered), Held (reason), Cancelled | Open row |
| Success | n/a — a list has no success state; journeys end on the campaign page | — |
| Retryable error | "Couldn't load your campaigns. Check your connection and try again." | Try again |
| Terminal error | WhatsApp needs reconnecting: "WhatsApp needs reconnecting. Scheduled campaigns are held until then." | Reconnect |
| Refused | n/a — any member may open campaigns (parent Q8) | — |
| Stale | Sending rows refresh every 10 s while open | — |
| Long content | Name truncates to one line | — |
| Many items | Newest first, 20 per page, filter Scheduled · Sent · Held | — |
| Slow | "Still loading…" after 3 s | — |
| Phone / tablet / desktop | One column / two (`md:`) / list beside the open campaign (`lg:`) | — |

## State matrix — Composer
| State | What the person sees | Action |
|---|---|---|
| First use | Step 1, first approved template preselected | Next: products |
| No approved template | "You need an approved template first. Your starter set is with Meta." | Open templates |
| Step 2 none picked | "Optional. Add up to 30 products; they show as a list customers can tap." | Skip products |
| Product still syncing | "Still syncing to WhatsApp; it will be left out if not ready at send." | — |
| Over 30 products | "WhatsApp shows up to 30 products in one message." | — |
| Empty list | "No one on this list has opted in yet." | Open audience |
| Review | Will get it, each skip reason with its count, price per message, "Up to ₹x", monthly meter "This month: ₹190 of your ₹{limit} limit" | Schedule for <time> / Send now |
| Partly over limit | "Only 40 fit in your monthly limit; the rest will wait until you raise it." | Raise limit · Send to 40 |
| No limit set | "No monthly limit set. Set one?" under the meter | Set limit |
| Slow count | "Counting…", "Still counting…" after 3 s | — |
| Success | Campaign page; toast "Scheduled for Fri 8 Nov, 7:30 pm." or "Sending now." | — |
| Retryable error | "Couldn't save the campaign. Nothing was sent. Try again." | Try again |
| Phone / tablet / desktop | Steps stacked, docked primary / preview beside steps (`md:`) / same, wider (`lg:`) | — |

## State matrix — Campaign page
| State | What the person sees | Action |
|---|---|---|
| Scheduled | "Goes Fri 8 Nov, 7:30 pm to about 121." | Edit · Cancel |
| Sending | "Sending · 64 of 121" with a bar | Stop sending |
| Stopped | "Stopped by <member>. 57 not sent, not charged." | — |
| Sent (report) | Sent, Delivered, Read, Tapped, Not delivered, Skipped, Cost; who created, scheduled, sent | — |
| Not-delivered reasons | "Not on WhatsApp" · "Blocked your number" · "Meta limit reached" · "Couldn't deliver, try later" | — |
| Skip reasons | "Not opted in" · "Stopped messages" · "Already messaged today" · "Weekly limit" · "Daily limit across channels" | — |
| Held: template | "Held: Meta paused the template <name> after customer reports. Nothing was sent or charged." | Pick another template · Cancel |
| Held: late | "This was due <n> hours ago while sending was down. Send now or cancel." | Send now · Cancel |
| Held: limit | "Your monthly limit is reached. <n> waiting." | Raise limit · Cancel |
| Cost pending | Cost shows "≈ ₹104.06, final when Meta confirms" until delivery reports settle | — |
| Retryable error | "Couldn't load this campaign. Try again." | Try again |
| Phone / tablet / desktop | Figures as rows / two-column grid (`md:`, `lg:`) | — |

## State matrix — WhatsApp settings
| State | What the person sees | Action |
|---|---|---|
| Default | Number health chip, per-customer limit "1 a day · 4 a week", monthly limit as the shop set it while connecting, or "No monthly limit set." | Save |
| Above default limit | Amber: "Above 1 a day, customers report more often. Your number health can drop." | Save |
| Health Medium | Amber chip: "Some customers reported messages. Send less often for a few days." | — |
| Health Low | Red chip: "Meta now limits your daily messages. Send less often for a week." | — |
| Saved | Toast "Saved." | — |
| Field error | "Enter a whole number above 0." · "Enter an amount in rupees, like 500." | Fix |
| Retryable error | "Couldn't save. Try again." | Try again |

## Copy deck
- Stop dialog: "Stop sending?" · "57 people haven't got it yet. They won't, and you won't be charged for them." · Stop sending · Keep sending
- Review footnote: "Counted again at send; never more than <n> people. You pay Meta from your WhatsApp account."
- Language note: "Each customer gets their language; English if theirs isn't approved."
- No default spend limit (parent Q8): the shop sets it while connecting WhatsApp. Settings line under the field: "Covers campaigns, alerts and template replies from Inbox." 

## Sign-off
Waiting for the owner's review.
