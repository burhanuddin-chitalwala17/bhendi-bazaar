# UX — bulk-publish

- **Status:** Draft
- **Verified:** 2026-11-22
- **Prototype:** [social-selling/prototypes/bulk.html](../social-selling/prototypes/bulk.html)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [social-selling ux-patterns](../social-selling/ux-patterns.md) §4, the shipped readiness-fix pages and listing rows (`listing-fixes.tsx`, `listing-row.tsx`), [whatsapp-catalogue ux](../social-selling/whatsapp-catalogue/ux.md)

> Putting 300 products on a channel as three decisions, not 300: fix the groups that need fixing,
> accept the suggested pages, then look over a grouped review where everything ready is already
> ticked. It orchestrates the screens that exist (readiness-fix, marketplace-publish) and adds no
> second way to fix or send (Q3).

## Journeys
1. **Amazon, from the card (A1–A3).** Channels → Amazon card → **Publish many** → page "Put your
   products on Amazon": a bar "40 there · 180 ready · 80 need a fix · 0 left out" → step **1 Fix**:
   groups "No photo · 12", "Photo too small · 8", "No description · 30", "Missing material · 30",
   each **Fix 30** opening readiness-fix's page for those products → back, the counts move →
   step **2 Pages**: "120 match a page on Amazon by barcode · 60 need a new page" →
   **Accept all suggestions** (any row changeable) → step **3 Review**: groups "New listings · 180",
   "Changes · 12", "Left out · 80 (need a fix)", all ready ticked → **Send 192** (pending
   "Starting…") → progress "Sending · 64 of 192" (can leave) → done toast "192 sent. Each shows its
   result on its listing."
2. **Untick some.** In Review, untick the group "Changes" or one product; any row opens its full
   old-against-new view (the existing listing details panel). The button counts what is ticked.
3. **Run again (A4).** The bar reads "220 there · 0 ready · 80 need a fix"; Send says "Nothing new
   to send" on tap.
4. **WhatsApp (A5).** From the WhatsApp card's "6 left out · Fix": the page is only step 1, titled
   "Fix what's left out of WhatsApp", groups by why; no review (WhatsApp adds them by itself).
5. **Flipkart.** Steps 1 and 3; a line in step 2's place: "New products are created in Flipkart
   Seller Hub. Changes to products already there are sent from here."

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Bulk publish page | `/org/[orgId]/channels/[channel]/publish`; three steps on one page, `PageTabs`-like stepper at the top | New | R1–R8 |
| Entry points | Channel card "Publish many"; Products page `ActionBar` "Put on a channel" (picker of channels) | Changed | R1 |
| Fix pages | readiness-fix's existing pages, filtered to the group | Reused | R2 |
| Old-against-new | Existing listing details panel | Reused | R4 |

## State matrix — Bulk publish page
| State | What the shop sees | Action |
|---|---|---|
| First use | Bar of counts; step 1 open if anything needs a fix, else step 2/3 | The step |
| Loading | Bar and groups as skeletons; "Checking 300 products…" | — |
| Empty | "All your products are on Amazon." | — |
| Partial | Some groups fixed: counts update on return; a toast "30 moved to ready." | — |
| Review | Groups with checkboxes; ready ticked | Send <n> |
| Sending | Progress with counts; the page can be left; on return the same progress | — |
| Success | "<n> sent"; each listing shows Sent → Live or Needs attention | View listings |
| Retryable error | "Amazon didn't answer. 64 were sent; 128 will be tried again in a few minutes." | — |
| Refused | Send with nothing ticked: explains on tap "Tick at least one product." · channel disconnected | Reconnect |
| Stale | Products changed since review: "12 changed since you reviewed. Review again." | Review |
| Many items | Groups paged inside (50 at a time); select all in group | — |
| Phone / tablet / desktop | Phone: steps stacked, groups as cards, Send in the `ActionBar`; tablet/desktop: groups as tables | — |

## Copy deck
- "Publish many", "Put your products on <channel>", bar "<n> there · <n> ready · <n> need a fix · <n> left out".
- Steps "Fix", "Pages", "Review"; "Fix <n>", "Accept all suggestions", "Sell on this page", "Create a new page".
- Review groups "New listings", "Changes", "Left out"; "Send <n>" → "Starting…", "Sending · <n> of <m>", toast "<n> sent. Each shows its result on its listing."
- "Nothing new to send", "Tick at least one product.", "<n> changed since you reviewed. Review again."
- WhatsApp "Fix what's left out of WhatsApp"; Flipkart line as in journey 5.

## Sign-off
Not yet signed off. Awaiting the owner's review with the senior UX review.
