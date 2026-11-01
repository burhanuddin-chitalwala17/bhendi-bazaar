# UX — inventory-sync

- **Status:** Signed off
- **Verified:** 2026-10-29
- **Prototype:** https://claude.ai/artifact/Y9jppxUqJuAYLd4SpWFmmT (version 20, private to the owner; both features on one canvas, with a flow board per feature and the Channels page they start from)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [channel-import ux](../channel-import/ux.md), [src/components/CLAUDE.md](../../../../src/components/CLAUDE.md)

> Phone first (~360px). The same screens for every marketplace. Buttons are never disabled. Every
> string below is the string that ships.

## Journeys
1. **Turning sync on.** Channels → Amazon → "Stock sync: off" → "Turn on stock sync" → match
   locations (one Amazon location: one tap) → the preview: every listing whose count will change →
   "Send stock to Amazon" → "Stock sync on".
2. **Matching locations at connection.** Connect Flipkart → the listings are read → "Match your
   Flipkart locations" beside the listings: each Flipkart location with a suggested match → confirm.
3. **A sale on Amazon.** Nothing to do: within minutes the product shows one less, Flipkart shows it
   too, and Orders → Marketplace orders lists the sale.
4. **It goes wrong.** Sold on two marketplaces with none left → the product and the order read
   "Oversold". A new Flipkart location appears → "New Flipkart location — match it". Flipkart refuses
   our stock calls → "Flipkart doesn't let us send stock yet."

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Stock sync section | Marketplace's Listings page, top | New | R5, R6, R9 |
| Match locations | Sheet from the section, and after connecting | New | R11 |
| Turn-on preview | Page `/org/[orgId]/channels/[channel]/stock-sync` | New | R9 (Q4) |
| Product: On marketplaces | Product page | Changed: stock line per marketplace | R3, R5 |
| Marketplace orders | `/org/[orgId]/orders?tab=marketplace` | New tab | R7 (Q10) |

## State matrix — Stock sync section
| State | What the person sees | Action |
|---|---|---|
| Off | "Stock sync is off. Amazon keeps its own count." | Turn on stock sync |
| Locations to match | "Match your Flipkart locations before stock can be sent." | Match locations |
| On | "Stock sync on · sent 3 min ago · checked today 6:00 am" | Pause |
| Sending | "Sending stock to Amazon… 40 of 120" | — |
| Paused | "Stock sync paused. Sales are still counted here; Amazon keeps its own count." | Turn back on |
| Corrected by the daily check | Line "Today's check put 2 counts back: Black abaya M (Amazon showed 7, now 5)" | See all |
| New location | "New Flipkart location: Bhiwandi 421302. Match it to send its stock." | Match it |
| Retryable error | "Couldn't reach Amazon. We'll keep trying; nothing is lost." | — |
| Terminal error | "Amazon stopped accepting our access. Reconnect on Channels." | Go to Channels |
| Everything stocked by Amazon (FBA, Q20) | "All your Amazon listings are stocked by Amazon, so there's nothing to send." | — |
| Not allowed (Flipkart today, if refused) | "Flipkart doesn't let us send stock yet. Its own count stays as it is." | — |
| Phone / tablet / desktop | Stacked / same, wider / same, beside the listings tabs | — |

## State matrix — Match locations
| State | What the person sees | Action |
|---|---|---|
| One marketplace location | "Amazon collects from one address. Which of your locations is it?" with a pick | Use this location |
| Several | Each marketplace location (name, pincode) with a suggested match of yours and "Not used" | Save matches |
| No good suggestion | That row reads "Pick one of yours, or Not used" | — |
| Location gone | "No longer on Flipkart" on the row; nothing is sent to it | Remove |
| Your location closed | "Mumbai shop is closed here. Pick another." | — |
| Saved | Toast "Locations matched." | — |

## State matrix — Turn-on preview
| State | What the person sees | Action |
|---|---|---|
| Loading | "Reading Amazon's counts…"; after 3 s "Still reading Amazon…" | — |
| Changes | "18 listings will change; 102 already match." then rows "Black Nida Abaya – M · Amazon 7 → 5" | Send stock to Amazon · Not now |
| Nothing changes | "All 120 listings already match. Turn on to keep them that way." | Turn on stock sync |
| Archived products | Rows "Rida Set · archived · Amazon 3 → 0" | — |
| Many | Changes first, then "Show all" | Show all |
| Sent | Toast "Stock sync on for Amazon." | — |

## State matrix — Product and Marketplace orders
| State | What the person sees | Action |
|---|---|---|
| Product, in sync | On marketplaces line "Stock 5 · sent 2 min ago" | — |
| Product, waiting | "Stock 5 · sending…" | — |
| Product, oversold | "Oversold: 1 sold on Amazon with none left. Check the order." | See order |
| Orders tab, empty | "No marketplace orders yet. Sales on Amazon and Flipkart show here." | — |
| Orders tab, rows | Marketplace, order number, item, quantity, amount as reported, "Oversold" flag | — |
| Many orders | Newest first, 50 at a time | Show more |

## Copy deck
Buttons: "Turn on stock sync", "Match locations", "Use this location", "Save matches", "Not used",
"Send stock to {marketplace}", "Not now", "Pause", "Turn back on", "Match it", "See all", "See
order", "Go to Channels", "Show all", "Show more". Toasts: "Locations matched." "Stock sync on for
{marketplace}." "Stock sync paused for {marketplace}." Nothing says "sync" to mean anything but stock.

## Sign-off
Signed off by the owner, 2026-10-29, as the prototype stands (version 20): "I accept all the ux".
Changed while building, 2026-10-29: the preview's loading screen says "Reading the marketplace's
counts…" since it shows before the page knows which; a listing the preview could not read says so in
one line and gets our count when sync starts; Match locations has no "Not used" when the marketplace
has a single location; the Orders page gains "Store orders" and "Marketplace orders" tabs.
After review, 2026-10-29: a product whose listing the marketplace stocks itself reads "Stocked by
Amazon"; Marketplace orders rows can carry "Before stock sync" (Q24) and "Taken from your first
matched location" (Q18); a location matched to a shop location since closed is sent 0 and asks to be
matched again.
After self-review, 2026-10-29: the section adds "Amazon turned down n listings; their count there
stays as it is until the next change"; an order whose listing had no product reads "Not linked to a
product: stock not taken"; Save matches with nothing picked says "Pick a location first."
After the owner's first try, 2026-11-01: the preview opened with every Amazon row "1 → 0" because
Amazon's pickup address was not yet matched. Now the preview reads nothing and shows only "Match
your locations before stock can be sent." with Match locations, until every location is matched;
before the marketplace's locations are read it says "Reading your Amazon locations…". A listing in
stock there that would be sent 0 is listed first, marked "goes out of stock", under a line naming
how many will show out of stock.
