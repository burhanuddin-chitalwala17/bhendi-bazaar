# UX — channel-import

- **Status:** Signed off
- **Verified:** 2026-10-21
- **Prototype:** https://claude.ai/artifact/NhQb1cNBkWzqjkWRQuLmdT (private to the owner)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [channel-connectors ux](../channel-connectors/ux.md), [src/components/CLAUDE.md](../../../../src/components/CLAUDE.md), [ADR-0050](../../../adr/0050-three-form-factors-on-tailwinds-own-breakpoints.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Phone first (~360px). Buttons are never disabled. Every string below is the string that ships.
> The marketplace card is channel-connectors' card; this adds a line and a link to it.

## Journeys
1. **First read.** Connect Amazon → back on Channels, card Connected, a line "Reading your listings… 212 of 480" → tap "See listings" any time → the Listings page fills as the read goes.
2. **Check the links.** Listings page → "Linked" tab: each row names the product it is linked to and says "Linked by SKU" → nothing to do if right.
3. **Undo a wrong link.** A row → Unlink → toast "Unlinked. It won't be linked again automatically." with "Undo" for five seconds → the row moves to "Not linked".
4. **Read again.** Listings page → Read again → the progress line returns; new listings appear, removed ones say so.
5. **Refused Flipkart account.** Connect Flipkart → the first read finds the account in another shop → the card is Not connected and says why.

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Marketplace card | Channels | Changed: reading line, "See listings" link, refused-account note | R1, R8 |
| Listings page | `/org/[orgId]/channels/[channel]/listings` | New | R1–R7 |
| Listing row | On the Listings page | New | R3–R7 |
| Product editor: "On marketplaces" | `/org/[orgId]/products/[id]` | Changed: a read-only block | R11 |
| Listing details panel | Over the Listings page: bottom sheet on phone, side panel from `lg:` (ADR-0040 detail panel) | New | R10 |

## State matrix — Marketplace card (additions only)
| State | Body adds | Action |
|---|---|---|
| Connected, first read running | "Reading your listings… 212 of 480" with a thin progress bar | See listings |
| Connected, read done | "480 listings · 402 linked" | See listings |
| Connected, read stopped | "Reading stopped at 212 of 480. We'll pick up where it left off." | See listings |
| Connected, read refused: a different account | "That's a different Flipkart account from the one connected here. To switch accounts, disconnect this one first, then connect the new one." | See listings |
| Refused: Flipkart account in another shop | Chip "Not connected"; "This Flipkart account is already connected to another shop. An account can belong to one shop only; disconnect it there first." | Connect Flipkart |

## State matrix — Listings page
| State | What the person sees | Action |
|---|---|---|
| First use | Header "Amazon listings"; progress line "Reading your listings… 0 of ?"; skeleton rows | — |
| Empty | "Your Amazon account has no listings yet. When you add some on Amazon, tap Read again." | Read again |
| Loading | Header and tabs at once; eight skeleton rows | — |
| Partial (read running) | Rows read so far, counts updating, line "Reading… 212 of 480" | — |
| Success | Tabs "Linked 402" · "Not linked 78"; line "Read 2 min ago" | Read again |
| Retryable error | "Reading stopped at 212 of 480. Amazon is busy; we'll try again in a few minutes." Rows so far stay | Read again |
| Terminal error | "Amazon stopped accepting our access, so we can't read your listings. Reconnect on Channels." | Go to Channels |
| Refused | Flipkart account in another shop: the page says so and shows no rows | Go to Channels |
| Different account | "That's a different Flipkart account from the one connected here. To switch accounts, disconnect this one first, then connect the new one." Rows so far stay | Go to Channels |
| Stale | "Read 3 days ago" in warning colour | Read again |
| Long content | Titles truncate to two lines; a tap shows the full title | — |
| Many items | A search box ("Search title or SKU") above the tabs; 50 rows, then "Show more" | Show more |
| Slow | Skeletons stay; after 3 s "Still loading…" | — |
| Phone / tablet / desktop | Rows stacked / rows with price and stock in a right column (`md:`) / a table with columns (`lg:`) | — |

## State matrix — Listing row
| State | What the row shows | Action |
|---|---|---|
| Linked by SKU | Image (or initial), title, "SKU ABY-BLK-M · ASIN B0C…", "Linked by SKU → Black Nida Abaya – M" | Unlink |
| Linked to an archived product | As above, plus "Archived here" | Unlink |
| Not linked | Image, title, SKU · id, "Not on Bhendi Bazaar yet" | — (product-merge) |
| Unlinked by you | As Not linked, plus "Unlinked by you" | Link back (toast "Linked to Hijab Pins – 24.") |
| No longer on the marketplace | Greyed; "No longer on Amazon" | — |
| Status there | A chip: "Live" (buyable), "Inactive", "Incomplete" | — |
| Price and stock | "₹1,899 · 9 in stock", from the marketplace, read-only | — |
| Variant group (Amazon) | A header row: "Black Nida Abaya · 4 sizes on Amazon" with the axis ("by size"), then its children indented, each with its own SKU and link; the header collapses on a tap | Collapse / expand |
| Flipkart variants | Ungrouped rows; one line under the tabs: "Flipkart doesn't say which listings are sizes of one item. You'll group them when adding products." | — |

## State matrix — Listing details panel
| State | What the person sees | Action |
|---|---|---|
| Linked, no differences | Two columns, "On Amazon" and "On Bhendi Bazaar": image, title, SKU, id, status, price, stock. Footer: "Linking changes nothing on your product." | Unlink · Close |
| Linked, with differences | As above; each differing value marked "Different" (e.g. price ₹1,999 vs ₹1,899). Footer adds: "Differences are settled when you set up this product's Amazon listing." | Unlink · Close |
| Not linked | Only "On Amazon"; the other column says "Not on Bhendi Bazaar yet. You'll add or match it in the next step." | Close |
| Unlinked by you | As Not linked, with the product it was linked to named | Link back · Close |
| No longer on the marketplace | "On Amazon" values greyed under "No longer on Amazon" | Close |
| Long content | Full title and all values wrap; the panel scrolls | — |
| Phone / tablet / desktop | Columns stack (marketplace first) on phone; side by side from `md:`; a side panel beside the list at `lg:` | — |

## State matrix — Product editor "On marketplaces"
| State | What the person sees | Action |
|---|---|---|
| Linked | "Amazon · ● Linked by SKU · ASIN B0C7X2… · Live · ₹1,999 · 9 in stock" | See listing |
| Linked, marketplace connection lost | As Linked, with "Amazon needs reconnecting; this is what it last reported" | Go to Channels |
| No longer on the marketplace | "Amazon · No longer on Amazon" | See listing |
| Not linked | "Flipkart · Not linked" | — |
| Marketplace not connected | The marketplace is not listed | — |
| No marketplace connected | The block is not shown | — |
| Phone / tablet / desktop | One line per marketplace, wrapping on phone | — |

## Copy deck
Every string above ships as written. Toasts: "Unlinked. It won't be linked again automatically." with
"Undo"; "Reading again…". A row never says "imported" (nothing is created, Q2); a product is "on
Bhendi Bazaar", a listing is "on Amazon" or "on Flipkart". Prices and stock are what the
marketplace last said, and the line "As Amazon last reported" sits under the tabs.

## Sign-off
Signed off by the owner, 2026-10-21, as the prototype stands (version 5).

Added while building, 2026-10-21: the "different account" rows (a reconnect that consents with another
Flipkart account than the one this connection read before), using the copy already agreed in chat. Removed while building: the "No SKU on the
marketplace" row, which cannot occur — Amazon's report and Flipkart's listings both key every
listing by its SKU.
