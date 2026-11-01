# UX — own-store/org-profile

- **Status:** Signed off
- **Verified:** 2026-11-02
- **Prototype:** `seller-portal-prototype.html`, section "Shop details" (shared with seller-onboarding; to be published as a private artifact)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [seller-onboarding ux](../seller-onboarding/ux.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

## Journeys
Each starts one step before the screen.
1. **Fill the essentials (R3, A1).** Home → setup step "Add your logo and a line about your
   shop" → hint → Shop details, "Buyers see this" open at Logo → upload → "One line about your
   shop" → "Save" → "Saved. Buyers see this on your shop page now." → back to Home, step ticked.
2. **Add more to the shop page (R3, R10).** Shop tab → Shop details → "Add more to your shop
   page" → "About your shop · adds the 'About' section" → type → "Save" → "See as a buyer".
3. **Change the mobile number (R5, A3).** More → Shop details → "Only Bhendi Bazaar sees this"
   → "Your mobile number" → edit → "Save" → "Saved. We'll call this number about orders."
4. **Rename the shop (R5; goes wrong).** Shop details → "Shop name" → edit → "Save" → sheet
   "Buyers will see {new} on your shop and every product. Your link stays {link}." → "Change
   name" → saved. Wrong: 2 letters → "Use at least 3 letters."; network drop → "Couldn't save.
   What you typed is still here." with "Try again".
5. **Looking for tax fields (R6).** Shop details → bottom card "Tax and bank details · We'll ask
   before your first payout. Nothing to do now."

## Screens
| Screen | Route | Reached from | Serves |
|---|---|---|---|
| Create your shop (fields only; screen in seller-onboarding) | `/org/new` | "Start selling" | R1 Q2, A1 |
| Shop details | `/org/[orgId]/shop/details` | Shop tab, More → Shop details, setup step 4 | R1–R10 |
| Name change sheet | over Shop details | "Save" after a name edit | R5, Q15 |

## Before and after — fields
| Today (where) | After | Part | Why |
|---|---|---|---|
| Organisation Code (admin form) | hidden from the shop | — | R8 |
| Organisation Name | Shop name — "Buyers see this on your shop and every product." | Buyers + at create | Q12 |
| Email · "org@example.com" | Email for order updates — "We send new orders here." | Only us + at create, prefilled | Q2 |
| Phone | Your mobile number — "We'll call or message you about orders and pickups. Buyers never see it." Any country, India selected first | Only us + at create | Q8, Q26 |
| Contact Person · "John Doe" | removed | — | Q3 |
| Business Name · "ABC Traders Pvt Ltd" | moved to first payout as "Name on your GST or bank papers" | — | Q9 |
| GST Number, PAN Number | moved to first payout | — | own-store Q14 |
| Description (create) + Introduction + The longer story | About your shop — one box | Buyers, optional | Q4 |
| Tagline | One line about your shop — essential | Buyers | Q11 |
| Logo | Logo — essential, "Shows at the top of your shop page and on WhatsApp shares." | Buyers | Q11 |
| Where you are | Area and city — "Bhendi Bazaar, Mumbai" | Buyers, optional | Q12 |
| Name / What they do here / One line worth quoting / Photograph | The person behind the shop — name, role, a line they'd say, photo | Buyers, optional | Q12 |
| Social handles | Instagram, Facebook… — "Just the handle, like noorattar" | Buyers, optional | — |
| Delivery / Returns (free text) | Delivery and returns — presets + note | Buyers, optional | Q7 |
| Accent (raw token names) | moved to storefront-themes palettes | — | own-store Q15 |
| Cover image | moved to storefront-themes | — | R7 |
| Block 1–3 heading/line ("How you work") | moved out, text kept | — | Q6 |
| Hide sections | moved to storefront-themes | — | R7 |
| Shop link (handle) | Your shop link — "Changing it breaks links you've already shared." | Buyers | R5 |

## State matrix — Shop details
| State | Sees | Copy | Action |
|---|---|---|---|
| First use | Essentials open, three empty, optional list collapsed | "Start with these three. Everything else is optional." | Add logo |
| Empty | All optional fields blank, essentials done | "Your shop page shows the basics. Add more whenever you like." | Add more |
| Loading | Section skeletons; a refresh keeps the values on screen | — | — |
| Partial | Essentials 2 of 3, each optional row says what it adds | "About your shop · adds the 'About' section" | Add |
| Unsaved | A bar on the tab bar (foot of the column from md), only while something changed (Q30) | "Unsaved changes" | Discard · Save |
| Success | Toast, section stays open, bar goes | "Saved. Buyers see this on your shop page now." · several sections: "All changes saved." | See as a buyer |
| Partly saved | The rest save; the failed section opens and scrolls into view with its own banner or field message; the bar stays | "Not everything saved. The section that didn't says why." | Fix · Save |
| Retryable error | Banner on the section, values kept | "Couldn't save. What you typed is still here." | Try again |
| Terminal error | Field message under the field | "Use at least 3 letters." · "Enter a valid phone number for the selected country" · "Use the handle on its own, not a web address." | Fix field |
| Refused | Staff editing name/contact; or link taken | "Only the shop owner can change this." · "That link is taken. Try {suggestion}." | Ask owner / use suggestion |
| Stale | Another member saved meanwhile | "Someone changed this 2 min ago. Load their version?" | Load latest |
| Long content | About up to 4,000 chars, counter from 3,600; name wraps; over the limit the about save is refused | "3,812 / 4,000" · "Keep it to 4,000 letters. Cut a little and save again." · note: "Keep the note to 280 letters." | Cut and save |
| Many items | n/a — fixed field set | — | — |
| Slow | "Still saving…" after 3 s, button stays tappable once | — | — |
| Phone / tablet / desktop | One column; `md:` same with wider fields; `lg:` live buyer preview on the right | — | — |

## State matrix — Name change sheet
| State | Sees | Copy | Action |
|---|---|---|---|
| First use | Old → new, where it shows | "Buyers will see {new} on your shop and every product. Your link stays {link}." | Change name |
| Empty | n/a — opened only on a change | — | — |
| Loading | "Changing…" | — | — |
| Partial | n/a — one write | — | — |
| Success | Sheet closes | "Name changed." | — |
| Retryable error | In sheet | "Couldn't change it. Try again." | Try again |
| Terminal error | Back to field | "Use at least 3 letters." | Fix |
| Refused | Staff | "Only the shop owner can change this." | Close |
| Stale | Another member saved name, mobile or email meanwhile (added in unit 3 review: the sheet shares the org's version) | "Someone changed this 2 min ago. Load their version?" | Load latest |
| Long content | Names wrap | — | — |
| Many items | n/a | — | — |
| Slow | "Still changing…" | — | — |
| Phone / tablet / desktop | Bottom sheet; `lg:` centred dialog | — | — |

## Copy deck
- Page: title "Shop details" · under the title (built in U2 as the header's line, not a "?" sheet,
  so a seller reads it without a tap): "Your shop's facts. Buyers see the top part; only we
  see the bottom part."
- Part headers: "Buyers see this — on your shop page" · "Only Bhendi Bazaar sees this — to reach
  you about orders and payouts".
- Essentials header: "Start with these three"; optional header: "Add more to your shop page".
- Optional rows: "About your shop · adds the 'About' section" · "Area and city · shows under
  your name" · "The person behind the shop · adds a face buyers trust" · "Social handles · adds
  your Instagram and Facebook" · "Delivery and returns · tells buyers what to expect".
- Tax card: "Tax and bank details · We'll ask before your first payout. Nothing to do now."
- Buttons: "Save" (the one save bar, Q30) · "Discard" · "See as a buyer" · "Change name" · "Keep old name" · "Try again".
- Toasts: "Saved. Buyers see this on your shop page now." · "Saved. We'll call this number about
  orders." · "Saved. New orders will come to this email." (added building U3: an email save had no
  line of its own) · "Name changed." · email to old address: "Your shop's email was changed".
- Name sheet title (added building U3; the sheet needs one): "Change your shop's name".

## Sign-off
Signed off by the owner, 2026-10-30, from the prototype file (approved as drawn).
