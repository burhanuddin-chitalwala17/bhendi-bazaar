# UX — inventory-sync

- **Status:** Signed off
- **Verified:** 2026-11-04
- **Prototype:** https://claude.ai/artifact/Y9jppxUqJuAYLd4SpWFmmT (version 20, private to the owner; both features on one canvas, with a flow board per feature and the Channels page they start from)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [channel-import ux](../channel-import/ux.md), [src/components/CLAUDE.md](../../../../src/components/CLAUDE.md)

> Phone first (~360px). The same screens for every marketplace. Buttons are never disabled. Every
> string below is the string that ships.

## Journeys
1. **Sync starts on connecting** (Q27). Connect Amazon → the listings and locations are read → match
   locations if asked (one Amazon location: one tap) → sync starts by itself; the Channels card reads
   "Stock sync on". Pausing is there too, beside Disconnect.
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
| Stock sync section | Marketplace's Listings page, top, only when it needs the shop (Q27) | New | R5, R6, R9 |
| Match locations | Sheet from the section, and after connecting | New | R11 |
| Channels card | Channels page: "Stock sync on" or "Stock sync paused", Pause / Turn back on beside Disconnect | Changed (Q27) | R9 |
| Home | "Needs you now": a location match sync waits on; listings our send put out of stock | Changed (Q27) | R9 |
| Product: On marketplaces | Product page | Changed: stock line per marketplace | R3, R5 |
| Marketplace orders | `/org/[orgId]/orders?tab=marketplace` | New tab | R7 (Q10) |

## State matrix — Stock sync section
Shown only when it needs the shop (Q27); a healthy sync shows nothing here.

| State | What the person sees | Action |
|---|---|---|
| On, healthy / starting | Nothing | — |
| Locations to match | "Match your Flipkart locations so stock can be sent." | Match locations |
| Paused | "Stock sync paused. Sales are still counted here; Amazon keeps its own count. Turn it back on in Channels." | Go to Channels |
| New location | "New Flipkart location: Bhiwandi 421302. Match it to send its stock." | Match it |
| Retryable error | "Couldn't reach Amazon. We'll keep trying; nothing is lost." | — |
| Turned down | "Amazon turned down 2 listings; their count there stays as it is until the next change." | — |
| Terminal error | "Amazon stopped accepting our access. Reconnect on Channels." | Go to Channels |
| Not allowed (Flipkart today, if refused) | "Flipkart doesn't let us send stock yet. Its own count stays as it is." | — |
| Phone / tablet / desktop | Stacked / same, wider / same, beside the listings tabs | — |

## State matrix — Channels card and Home (Q27)
| State | What the person sees | Action |
|---|---|---|
| Card, sync on | Line "Stock sync on" | Pause |
| Card, paused | Line "Stock sync paused" | Turn back on |
| Card, waiting for a match | No stock line | — |
| Toasts | "Stock sync paused for Amazon." / "Stock sync on for Amazon." | — |
| Home, match needed | "Match your Amazon locations so stock can be sent" | Opens Listings |
| Home, put out of stock | "3 listings now out of stock on Amazon: we have 0" until the next read | Opens Listings |

## State matrix — Match locations
| State | What the person sees | Action |
|---|---|---|
| One marketplace location | "Amazon collects from one address. Which of your locations is it?" with a pick | Use this location |
| Several | Each marketplace location (name, pincode) with a suggested match of yours and "Not used" | Save matches |
| No good suggestion | That row reads "Pick one of yours, or Not used" | — |
| Location gone | "No longer on Flipkart" on the row; nothing is sent to it | Remove |
| Your location closed | "Mumbai shop is closed here. Pick another." | — |
| Saved | Toast "Locations matched." | — |

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
Buttons: "Match locations", "Use this location", "Save matches", "Not used", "Pause", "Turn back
on", "Match it", "See order", "Go to Channels", "Show more". Toasts: "Locations matched." "Stock sync on for
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
Owner, 2026-11-04 (Q27): connecting turns sync on, so the "Turn on stock sync" switch and the
turn-on preview are gone. The Listings page shows stock sync only when it needs the shop; Pause and
Turn back on move to the Channels card; Home names listings our send put out of stock and asks for
a location match sync waits on.
