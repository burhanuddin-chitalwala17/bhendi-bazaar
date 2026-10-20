# UX — channel-connectors

- **Status:** Signed off
- **Verified:** 2026-10-20
- **Prototype:** https://claude.ai/artifact/UcvpXaYM2wiTr6zrWoze9K (private to the owner)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [src/components/CLAUDE.md](../../../../src/components/CLAUDE.md), [ADR-0050](../../../adr/0050-three-form-factors-on-tailwinds-own-breakpoints.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md), [ADR-0040](../../../adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md)

> Phone first (~360px). Buttons are never disabled; an action that cannot happen explains itself on
> tap. Every string below is the string that ships.

## Journeys
1. **Connect Amazon.** Channels → Amazon card → Connect Amazon → Amazon's own page (sign in if
   needed, Allow) → back on Channels, card Connected, toast "Amazon connected." Flipkart is the same.
2. **Cancel or fail on the way.** The seller taps Cancel on Amazon, the link has expired, or Amazon
   does not answer → back on Channels with a note saying what happened and the button to try again.
3. **Refused.** The Amazon account is already connected to another shop, or Amazon's 25-shop limit
   is reached → back on Channels with the reason; nothing is connected.
4. **Keep it alive.** Amazon's yearly re-approval approaches → card and dashboard say "Renew by
   12 Nov" → Renew now runs journey 1 again, keeping the connection. A renewal that fails for good
   → "Needs reconnecting" with the reason → Reconnect.
5. **Disconnect.** Card → Disconnect → dialog says what stops → Disconnect → card Not connected,
   with how to revoke our access on the marketplace.
6. **Turn on Google or Meta.** Card → Turn on → on, feed included. Turn off reverses it.

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Channels page | `/org/[orgId]/channels`, shop menu under Products (Q5) | New | R1, R5, R8, R10 |
| Marketplace card (Amazon, Flipkart) | On Channels | New | R1–R7, R10 |
| Feed card (Google, Meta) and Own store card | On Channels | New | R8 |
| Return outcome note | Top of Channels after coming back | New | R2, R3, journey 2–3 |
| Disconnect dialog | Over Channels | New | R7 |
| Dashboard banner | `/org/[orgId]` | Changed | R9 |
| What you sell | `/org/[orgId]/listing` | Changed: "Where you sell" removed | R8 |

## State matrix — Channels page
| State | What the person sees | Action |
|---|---|---|
| First use | Intro line "Connect a marketplace to sell there from Bhendi Bazaar." Own store card On; Amazon and Flipkart Not connected; Google and Meta Off | Connect Amazon |
| Empty | n/a — the own store card is always there | — |
| Loading | Five card skeletons in final positions | — |
| Partial | Some cards connected, some not; each card states itself | Each card's own |
| Success | After a connect, the return note and the card updated together | — |
| Retryable error | Page cannot load: "Couldn't load your channels. Check your connection and try again." | Try again |
| Terminal error | n/a — any failure here is retryable | — |
| Refused | Shop suspended: the portal's existing suspended screen; Channels never shows | — |
| Stale | n/a — read fresh on every visit | — |
| Long content | Long shop or account names wrap on two lines, then truncate with the full text on press | — |
| Many items | n/a — five channels; a sixth adds one card | — |
| Slow | Skeletons stay; after 3 s a line "Still loading…" | — |
| Phone / tablet / desktop | One column / two cards across (`md:`) / three across (`lg:`); order: own store, Amazon, Flipkart, Google, Meta | — |

## State matrix — Marketplace card
| State | Chip | Body | Primary action |
|---|---|---|---|
| Not connected (first use) | Not connected | "List, update stock and get orders from your Amazon seller account." | Connect Amazon |
| Redirecting | — | Button shows a spinner and "Opening Amazon…" | — |
| Connected | ● Connected | "Connected by Farida · 20 Oct 2026" · "Last checked 2 min ago" · Amazon only: "Re-approve by 20 Oct 2027" | Disconnect (secondary, red text) |
| Renewal due (Amazon, ≤30 days) | Renew by 12 Nov | "Amazon asks sellers to re-approve apps once a year. It takes one tap; nothing is lost." | Renew now |
| Needs reconnecting | Needs reconnecting | Reason, one of: "Amazon stopped accepting our access." · "Flipkart's approval expired." · "Access was removed from Seller Central." | Reconnect |
| Disconnected (before) | Not connected | "Disconnected by Farida · 18 Oct 2026." | Connect Amazon |
| Unavailable (switched off / not set up) | Coming soon | "Connecting Flipkart isn't open yet. We'll show it here when it is." | Tell me more (explains, never disabled) |
| Refused: limit reached (Amazon) | Full for now | "Amazon allows 25 shops until it approves our app listing. We'll tell you here when it opens." | — (tap explains) |
| Retryable error | — | Shown as the return note, not on the card | — |
| Stale | "Last checked 3 days ago" turns amber when older than 24 h | — | Check now |
| Long content | Account name truncates at one line | — | — |
| Slow | "Opening Amazon…" past 3 s adds "Still working…" | — | — |
| Phone / tablet / desktop | Same card; actions full-width on phone, inline from `md:` | — | — |

## State matrix — Return outcome note
| Outcome | Tone | Text | Action |
|---|---|---|---|
| Connected | Success toast | "Amazon connected." | — |
| Different account on reconnect (Q8) | Warning note | "That's a different Amazon account from the one connected here. To switch accounts, disconnect this one first, then connect the new one." | Disconnect |
| Cancelled (Q7) | Neutral note | "Nothing was connected. You can connect Amazon any time." | Connect Amazon |
| Link expired or altered (R2) | Warning note | "That link has expired. Start again from here." | Connect Amazon |
| Started by someone else | Warning note | "This connection was started from another sign-in. Start again from here." | Connect Amazon |
| Account already in another shop (R3) | Error note | "This Amazon account is already connected to another shop. An account can belong to one shop only; disconnect it there first." | — |
| Marketplace did not answer | Error note | "Amazon didn't respond. Nothing was connected. Try again in a minute." | Try again |
| Limit reached (R10) | Warning note | "Amazon is full for now. We'll tell you here when it opens." | — |

## State matrix — Disconnect dialog
| State | What the person sees | Action |
|---|---|---|
| Default | Title "Disconnect Amazon?" · **Stops:** "Stock, prices and orders stop updating between Bhendi Bazaar and Amazon." · **Stays:** "Your listings on Amazon stay live as they are. Your products and their Amazon links stay here, and pick up again if you reconnect this account." · **Watch out:** "Amazon will keep selling at the stock it last had. Pause listings in Seller Central if you don't want that." · "To remove us completely, also revoke Bhendi Bazaar in Seller Central → Apps." (Q9) | Disconnect · Keep connected |
| Working | Button spinner "Disconnecting…" | — |
| Success | Dialog closes; card Not connected; toast "Amazon disconnected." | — |
| Retryable error | Inside the dialog: "Couldn't disconnect. Try again." | Try again |
| Phone / tablet / desktop | Bottom sheet on phone; centred dialog from `md:` (ADR-0040) | — |

## State matrix — Dashboard banner
| State | Text | Action |
|---|---|---|
| None | No banner | — |
| Renewal due | "Amazon needs a quick re-approval by 12 Nov to keep selling there." | Renew now |
| Needs reconnecting | "Flipkart needs reconnecting. Stock and orders aren't updating there." | Reconnect |
| Both channels | One banner: "2 channels need attention." | Open Channels |

## State matrix — Feed card (Google, Meta) and Own store card
| State | Text | Action |
|---|---|---|
| Off (first use) | "Show your products on Google Shopping. No account needed; Google reads your catalogue." | Turn on |
| On | "On · your products are in Google's feed." | Turn off |
| Retryable error | Toast "Couldn't change that. Try again." | Try again |
| Own store | "Always on · bhendi-bazaar.com/store/<handle>" | View store |

## Copy deck
Every string above ships as written. Shared words: a marketplace is "connected", never "linked" or
"authorised"; "Re-approve" is Amazon's yearly step, "Reconnect" is any lost connection; dates read
"20 Oct 2026".

## Sign-off
Signed off by the owner, 2026-10-20, as the prototype stands (version 3).
