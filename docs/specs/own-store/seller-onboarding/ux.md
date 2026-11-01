# UX — own-store/seller-onboarding

- **Status:** Signed off
- **Verified:** 2026-11-01
- **Prototype:** `seller-portal-prototype.html` (shared with org-profile; to be published as a private artifact)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [org-profile ux](../org-profile/ux.md), [src/components/CLAUDE.md](../../../../src/components/CLAUDE.md), [ADR-0040](../../../adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

## Journeys
Each starts one step before the screen.
1. **Create a shop (R1, A1).** Account menu "Start selling" → Create your shop: name, mobile
   (email filled from the account) → link previews as the name is typed → "Create my shop" → Home,
   toast "Your shop is open", setup list "1 of 5 done".
2. **First product, from the list (R3, R4, R7, A2).** Home → step "Add your first product" →
   hint sheet (2 cards: "Photos sell", "Price and stock") → "Add product" → product form →
   "Save" → back on Home, toast "Product added · 2 of 5 done", the next step highlighted.
3. **Pickup address over the form (R8, A4; goes wrong).** Product form → Stock "Ships from" →
   "No pickup address yet" → "Add pickup address" → sheet → "Save address" → sheet closes,
   address selected, form intact. Wrong: pincode not found → named under the field; network drop
   → "Couldn't save. Your form is safe." with "Try again".
4. **Logo and line (R3).** Home → step 4 → hint (1 card) → Shop details essentials (org-profile
   ux) → "Save" → Home, "3 of 5 done".
5. **Share (R10, A2).** Home → step 5 → sheet: link, preview card, "Share on WhatsApp", "Copy
   link", "See as a buyer" → WhatsApp opens with the message → back, toast "Shared · 5 of 5 done"
   → list collapses to "Your shop is set up". Wrong: no WhatsApp on the device → "Copy link"
   offered with "Copied. Paste it in any chat."
6. **Find anything (R6, A3).** Any page → bottom bar, or More → grouped list with a purpose line
   per item → page. Desktop: grouped sidebar.
7. **Read a review where it is (R9).** Home "2 new reviews" → product page, Reviews section
   scrolled to → back to Home. Or Shop tab → Reviews.
8. **Hide the list and get it back (R3, A6).** Home → "Hide for now" → toast "Hidden. Find it
   under More → Setup list" with "Undo".

## Screens
| Screen | Route | Reached from | Serves |
|---|---|---|---|
| Create your shop | `/org/new` | account menu, "Start selling" | R1, A1 |
| Home | `/org/[orgId]` | tab Home | R2, R3, A1, A6 |
| Hint sheet | over Home or any page ("?") | setup step, "?" | R4, R5, A5 |
| More sheet | over any page | tab More | R6, A3 |
| Shop hub | `/org/[orgId]/shop` (new) | tab Shop | R8, R9, R10 |
| Add pickup address sheet | over product form, parcel, Shop hub | "Add pickup address" | R8, A4 |
| Share sheet | over Home, Shop hub, after first product | "Share" | R10 |

## State matrix — Create your shop
| State | Sees | Copy | Action |
|---|---|---|---|
| First use | Two fields, link preview | "Open your shop. Two things now; the rest when you need it." | Create my shop |
| Empty | Same as first use | — | Create my shop |
| Loading | Button shows spinner, stays tappable once | "Opening your shop…" | — |
| Partial | n/a — one form, one save | — | — |
| Success | Home | "Your shop is open" | — |
| Retryable error | Banner over the form, values kept | "Couldn't open your shop. Check your internet and try again." | Try again |
| Terminal error | Field message | "Use at least 3 letters." / "Enter a valid phone number for the selected country" | Fix field |
| Refused | Not signed in → sign-in sheet, returns here | "Sign in to open your shop." | Sign in |
| Stale | n/a — nothing loaded | — | — |
| Long content | Name wraps; link preview truncates mid with "…" | — | — |
| Many items | n/a — two fields | — | — |
| Slow | After 3 s | "Still opening… don't close this page." | — |
| Phone / tablet / desktop | Single column; `md:` centred card 28rem | — | — |

## State matrix — Home
| State | Sees | Copy | Action |
|---|---|---|---|
| First use | Greeting, setup list 1 of 5, numbers line | "Welcome, {Shop name}. Five steps to your first sale." | Next step |
| Empty | Setup done, nothing needs you | "All caught up." | Share your shop |
| Loading | Skeleton rows per section; refresh keeps old values | — | — |
| Partial | List 3 of 5, next step highlighted; a failed section shows its own retry | "Couldn't load orders." | Retry |
| Success | List collapses to one line | "Your shop is set up." | See your shop |
| Retryable error | Section-level, others still render | "Couldn't load this. Try again." | Try again |
| Terminal error | n/a — sections fail alone and retry | — | — |
| Refused | Not a member → "This shop isn't yours" page | "You're not part of this shop. Switch shop or ask its owner." | Switch shop |
| Stale | Numbers older than 15 min | "Updated 20 min ago" | Refresh |
| Long content | Shop name wraps two lines then "…" | — | — |
| Many items | "Needs you now" shows 3, then "See all {n}" | "See all 5" (n counts lines, Q30) | See all |
| Slow | Skeleton holds; list shows from cache first | — | — |
| Phone / tablet / desktop | One column; `md:` list and needs-you side by side; `lg:` numbers 4-up | — | — |

## State matrix — Hint sheet
| State | Sees | Copy | Action |
|---|---|---|---|
| First use | Card 1 of n, dots | per step, see copy deck | Next / last card: the task |
| Empty | n/a — every hint has 1–3 cards | — | — |
| Loading | n/a — copy ships with the page | — | — |
| Partial | Closed mid-way: reopens at card 1 | — | — |
| Success | Last card's button starts the task | — | — |
| Retryable error | n/a — no request | — | — |
| Terminal error | n/a | — | — |
| Refused | n/a — hints never refuse | — | — |
| Stale | n/a | — | — |
| Long content | Card text wraps; max 2 sentences by rule | — | — |
| Many items | n/a — max 3 cards (own-store Q12) | — | — |
| Slow | n/a | — | — |
| Phone / tablet / desktop | Bottom sheet; `lg:` popover beside the step | — | — |

## State matrix — More sheet and sidebar
| State | Sees | Copy | Action |
|---|---|---|---|
| First use | Five groups, purpose line per item | — | Tap item |
| Empty | n/a — fixed list | — | — |
| Loading | n/a — static | — | — |
| Partial | n/a | — | — |
| Success | Sheet closes on navigate; current page marked | — | — |
| Retryable error | n/a | — | — |
| Terminal error | n/a | — | — |
| Refused | Staff on an owner-only page: item shown, page explains | "Only the shop owner can change this." | Back |
| Stale | Badge counts refresh with the page | — | — |
| Long content | Shop name in header truncates | — | — |
| Many items | 13 items fit one phone screen in groups; no search needed | — | — |
| Slow | n/a | — | — |
| Phone / tablet / desktop | Phone sheet; `md:` icon sidebar; `lg:` full grouped sidebar | — | — |

## State matrix — Shop hub
| State | Sees | Copy | Action |
|---|---|---|---|
| First use | Link card, four rows with status | "Shop details · 2 things to add" | Share |
| Empty | No reviews row status | "No reviews yet. They appear after buyers receive orders." | — |
| Loading | Row skeletons | — | — |
| Partial | Some rows "Add" | "Pickup addresses · none yet" | Add |
| Success | All rows ticked | "Everything buyers need is here." | Share |
| Retryable error | Row-level | "Couldn't load. Try again." | Try again |
| Terminal error | n/a — rows fail alone | — | — |
| Refused | Shop paused by platform | "Your shop is paused. Contact us to reopen it." | Contact us |
| Stale | n/a — read on open | — | — |
| Long content | Link truncates mid | — | Copy link |
| Many items | Addresses row shows count, opens list | "Pickup addresses · 4" | — |
| Slow | Skeletons after 300 ms | — | — |
| Phone / tablet / desktop | List; `lg:` two columns | — | — |

## State matrix — Add pickup address sheet / Share sheet
| State | Address sheet | Share sheet |
|---|---|---|
| First use | Name, contact, phone, address, pincode; "Save address" | Link, preview, three buttons |
| Empty | Same | n/a — always has a link |
| Loading | "Saving…" on button | Preview image loads, placeholder |
| Partial | n/a — one save | n/a |
| Success | Closes, selected, toast "Pickup address added" | Toast "Shared" / "Link copied" |
| Retryable error | "Couldn't save. Your form is safe." · Try again | Copy fails → "Long-press the link to copy it." |
| Terminal error | Field messages (pincode, phone) | n/a |
| Refused | Duplicate name → "You already have 'Main shop'. Use another name." | n/a |
| Stale | n/a | n/a |
| Long content | Address lines wrap | Long link truncates mid |
| Many items | n/a | n/a |
| Slow | "Still saving…" after 3 s | n/a |
| Phone / tablet / desktop | Sheet both (Q12); `lg:` 28rem side | Sheet; `lg:` popover |

## Copy deck
- Create: title "Open your shop" · "Shop name" hint "Buyers see this on your shop and every
  product." · "Your mobile number" hint "We'll call or message you about orders and pickups. Buyers
  never see it." (any country, India selected first; org-profile Q26) · "Your link: {url}" · button "Create my shop".
- Setup list: "Set up your shop · {n} of 5 done" · "Hide for now" · steps: "Your shop is open" ·
  "Add your first product" · "Add a pickup address" · "Add your logo and a line about your shop"
  · "Share your shop link" · done: "Your shop is set up."
- Hints: product — "Photos sell. Use daylight and a plain wall." / "Price and stock. You can
  change them any time." · address — "Couriers pick up from here. Buyers never see it." · logo —
  "Your logo and one line show at the top of your shop page." · share — "Send your link to
  customers on WhatsApp. They can order without calling you."
- WhatsApp message: "Visit {Shop name} online: {link}".
- Tabs: "Home · Orders · Products · Shop · More". More purpose lines: Orders "Pack and track
  parcels" · Products "Add and edit what you sell" · Brands and defaults "Facts every product
  starts with" · Photos "All your pictures in one place" · Shop page "What buyers see" · Pickup
  addresses "Where couriers collect from" · Reviews "What buyers say" · Offers "Discounts you run"
  · Channels "Sell on Amazon, Flipkart and more" · Bidding "Auctions for one-off pieces" · Money
  you'll receive "What you earned and when it's paid" · Shop details "Name, contact, tax" ·
  Setup list "Your five first steps" · Help "Ask us anything".
- Toasts: "Your shop is open" · "Product added · {n} of 5 done" · "Pickup address added" ·
  "Shared · {n} of 5 done" · "Link copied" · "Hidden. Find it under More → Setup list" · "Undo".

## Sign-off
Signed off by the owner, 2026-10-30, from the prototype file (approved as drawn).
