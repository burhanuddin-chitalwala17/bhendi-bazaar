# UX — readiness-fix

- **Status:** Signed off
- **Verified:** 2026-11-03
- **Prototype:** https://claude.ai/artifact/FCtXTxD6ZCMeaobWQFBd7e
- **References:** [spec.md](spec.md), [decisions.md](decisions.md)

> Phone first (~360px). Buttons are never disabled. Every string here ships.

## Journeys
1. **Colour for Google.** Products → card "Google Shopping · 79 need a colour · Fix them" → the page
   "Colour for Google Shopping · 79 to go" → each row: photo, name, picker → pick → row to Done → … →
   "All done. Google Shopping takes 80 of 83 now." → Back to products.
2. **Many at once.** On the page, tick the five black abayas → bar "Set colour for 5 selected" → pick
   Black → "5 set". One answered elsewhere meanwhile: "4 set · 1 already had a colour, left as it was".
3. **Amazon had a word.** A row shows "Amazon says: Dark Green" → the shop picks Green.
4. **It goes wrong.** Offline pick → the row stays with "Couldn't save. Try again." A gap with no fix:
   "3 have no Google category · Ask the admin".

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Ready to list elsewhere card | Products page, top | Changed: a line per gap with Fix them | R1, R6 |
| Fix page | `/org/[orgId]/products/fix?channel=google&fact=colour` | New | R2–R5 |

## State matrix — card
| State | What the person sees | Action |
|---|---|---|
| First use / empty | Hidden while the shop sells nowhere else (unchanged) | — |
| Partial | "Google Shopping · 80 of 83 would go" and under it "79 need a colour" · "3 have no Google category" | Fix them / Ask the admin |
| Success | "Google Shopping · 83 of 83 would go" | — |
| Many gaps | The three most common, then "and 2 more" opening the full list | Show all |
| Loading / errors | Server-rendered; a failed read hides the card (unchanged) | — |
| Phone / tablet / desktop | Lines stack on the phone; md: gap and action on one line | — |

## State matrix — fix page
| State | What the person sees | Action |
|---|---|---|
| First use | Title "Colour for Google Shopping", line "79 to go. Pick from the photo; each is saved as you pick." | Pick |
| Empty | "Nothing left. Google Shopping takes every product with a colour." | Back to products |
| Loading | Rows as grey bars on first load | — |
| Partial | To go above, a collapsed "Done (12)" below, each done row with Undo | Undo |
| Success | "All done. Google Shopping takes {n} of {m} now." | Back to products |
| Retryable error | On the row: "Couldn't save. Try again." | Try again |
| Terminal error | n/a — every answer offered is one the product's type takes | — |
| Refused | Bulk: "{n} set · {m} already had a colour, left as it was" | — |
| Stale | Another tab answered a row: it leaves on the next pick or refresh | — |
| Long content | Names wrap to two lines | — |
| Many items | 30 rows, "Show 30 more"; "Only with a marketplace word" filter | Show more |
| Slow | The picked row shows "Saving…" and stays usable | — |
| Phone / tablet / desktop | Phone: photo 72px left, name and picker right, checkbox at the edge, bar fixed above the tab bar. md: two columns of rows. lg: photo 96px | — |

## Copy deck
- Card: "{n} need a {fact}" · "{n} have no {channel} category" · "Fix them" · "Ask the admin" · "and {n} more"
- Page: "{Fact} for {channel}" · "{n} to go. Pick from the photo; each is saved as you pick." · "Done ({n})" · "Undo" · "Set {fact} for {n} selected" · "Only with a marketplace word" · "Show 30 more"
- Row: "{Marketplace} says: {value}" · "Saving…" · "Couldn't save. Try again."
- Results: "{n} set" · "{n} set · {m} already had a {fact}, left as it was" · "All done. {channel} takes {n} of {m} now." · "Nothing left. {channel} takes every product with a {fact}." · "Back to products"

## Sign-off
Signed off by the owner, 2026-11-03 ("signed off"), on the prototype above.
