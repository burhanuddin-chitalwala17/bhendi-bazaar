# UX — social-selling/whatsapp-catalogue

- **Status:** Draft
- **Verified:** 2026-11-06
- **Prototype:** [../comment-automations/prototype.html](../comment-automations/prototype.html), journeys 4–5 (local file shared with comment-automations; to be published as a private artifact once a claude.ai login is available)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [connect-whatsapp ux](../connect-whatsapp/ux.md), [src/components/CLAUDE.md](../../../../src/components/CLAUDE.md), [ADR-0040](../../../adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Phone first (~360px). Buttons are never disabled; an action that cannot happen explains itself on
> tap. Every string below is the string that ships.

## Journeys
1. **Made on connect.** Channels → WhatsApp connected (connect-whatsapp; the coexistence line is
   its screen) → the card's catalogue section says "Adding your products to WhatsApp…" → minutes
   later "142 products in your WhatsApp catalogue". In the WhatsApp app the shop's catalogue shows
   them at the store's prices; "View on website" opens our product page.
2. **Kept true.** The shop changes a price or sells the last unit → within 15 minutes WhatsApp
   shows it; the card's "Updated" time moves. Nothing to do.
3. **Left out or refused.** The card says "6 left out" or "3 not accepted by WhatsApp" → See which
   → a panel lists each product with why → Fix product opens the product.
4. **Force it.** Sync now → "Syncing…" → toast "WhatsApp catalogue is up to date."
5. **Disconnect.** WhatsApp card → Disconnect → the dialog adds the catalogue line → catalogue stops
   updating and stays in the shop's Meta account.

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Catalogue section of the WhatsApp card | On Channels, `/org/[orgId]/channels` | New section in connect-whatsapp's card | R1, R4, R7 |
| Catalogue issues panel | Detail panel over Channels on phone, inline at `md:` | New | R1, R8 |
| Disconnect dialog | connect-whatsapp's dialog | Changed: one line added | R9 |

## State matrix — Catalogue section
| State | What the person sees | Action |
|---|---|---|
| First use | Just connected: "Adding your products to WhatsApp… This takes a few minutes. You can leave this page." | — |
| Empty | Shop has no live product: "No products to show yet. Products you add to your store appear here automatically." | Add a product |
| Loading | One-line skeleton | — |
| Partial | "142 products in your WhatsApp catalogue" plus "6 left out: they need a photo or a description" and/or "3 not accepted by WhatsApp" | See which |
| Success | "142 products in your WhatsApp catalogue · Updated 3 min ago · prices and stock follow your store" | Sync now |
| Retryable error | "Couldn't reach WhatsApp. We'll keep trying; your catalogue shows its last update." | Try again |
| Terminal error | n/a — every catalogue failure is retried or listed per product | — |
| Refused | Connection needs reconnecting: "Catalogue updates are paused until WhatsApp is reconnected." | Reconnect |
| Stale | No update for over 24 hours: "Last updated yesterday, 9:14 pm." | Sync now |
| Long content | Counts only; long product names appear in the panel, wrapped to two lines then cut with "…" | — |
| Many items | Counts scale; no list on the card | — |
| Slow | Sync now shows "Syncing…" until the push is accepted (up to a few minutes; the page may be left) | — |
| Phone / tablet / desktop | Inside the WhatsApp card at every size | — |

## State matrix — Catalogue issues panel
| State | What the person sees | Action |
|---|---|---|
| First use | n/a — opened only when there is something to list | — |
| Empty | Everything fixed since opening: "Nothing left to fix." | Close |
| Loading | Row skeletons | — |
| Partial | Two groups: "Left out" (reason ours) and "Not accepted by WhatsApp" (Meta's reason) | Fix product |
| Success | n/a | — |
| Retryable error | "Couldn't load the list. Try again." | Try again |
| Terminal error | n/a | — |
| Refused | n/a — any member may view | — |
| Stale | "As of {time}" at the top | — |
| Long content | Meta's reason cut at 300 characters (decisions Q9) | — |
| Many items | First 50, then "Show more" | Show more |
| Slow | Skeleton; "Still loading…" after 3 s | — |
| Phone / tablet / desktop | Full-height panel / inline below the card at `md:` / inline at `lg:` | — |

## Copy deck
- Section label: "WhatsApp catalogue"
- "{n} products in your WhatsApp catalogue" · "Updated {relative time}" · "prices and stock follow your store"
- "Adding your products to WhatsApp…" · "This takes a few minutes. You can leave this page."
- "{n} left out: they need a photo or a description" · "{n} not accepted by WhatsApp"
- Panel reasons: "Needs a photo." · "Needs a description." · "WhatsApp says: {reason}"
- Buttons: "Sync now" · "Syncing…" · "See which" · "Fix product" · "Try again" · "Reconnect" · "Show more"
- Toast: "WhatsApp catalogue is up to date."
- Errors: "Couldn't reach WhatsApp. We'll keep trying; your catalogue shows its last update." ·
  "Catalogue updates are paused until WhatsApp is reconnected."
- Disconnect dialog line: "Your WhatsApp catalogue stays in your Meta account but stops updating.
  Delete it in Commerce Manager if you no longer want it."

## Sign-off
Pending the owner's review.
