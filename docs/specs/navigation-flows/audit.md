# Audit — where each feature starts, finishes and exits (2026-11-10)

- **Verified:** 2026-11-10
- **References:** [spec.md](spec.md), [decisions.md](decisions.md)

> The worklist this feature closes. A row leaves this file when its screen meets R1–R7. Paths are
> under `src/`. "Fixed list" means a hardcoded list page, not the screen that opened it.

## Seller portal
| Feature | Opened from | Finish goes | Back / Cancel goes | Warns | Gap |
|---|---|---|---|---|---|
| Edit product | Product page, Products list, listing screen (Fix, banners, facts card), bulk dialog | Stays, toast | Fixed `/products` | Yes | Eight starts, one Back; listing → Fix → Edit → Back skips two steps |
| New product | Home, Products, Look page, copy menu | Success screen (or Home with `from=home`) | Fixed `/products` | Yes | Back ignores `from=home`; from Look never returns to Look |
| Product page | Products, Requests, Home, Listings groups, listing screen | — | Fixed `/products` | — | List filters lost |
| Marketplace listing screen | Product page, Listings "Fix" | Stays, offers Publish | Fixed: product page | No | From `?fix=1` returns to the product, not the problems list |
| Put on marketplace | Product page | Listing screen / Publish | None | — | Dead end |
| Review and publish | Listings bar, listing screen, put-on (family) | Listing screen or Listings | None unless empty | No | Dead end; family case finishes away from the product |
| Add / match listing (settle) | Listings details panel, match picker | Listings `?tab=linked` | Only in error box | No | Dead end; search, page and panel lost |
| Group into family | Same-item card, settle, picker, group row | Listings `?tab=linked` | None | No | Dead end; from settle skips settle |
| Bulk upload | Products | Plain link to `/products` | None | No | Dead end; upload abandoned silently |
| Fix missing fact | Products `?channel=` | Link to `/products` | None while rows remain | — | Dead end; drops `?channel=` |
| Offers new / edit | Offers list | Fixed list | Cancel only, fixed list | No | Filters lost; no header Back |
| Bidding new | Bidding list dialog | Bidding list | Bidding list | No | Warning only |
| Locations | Home, Shop, bulk upload sheet | Home only with `from=home` | None | No | Shop and bulk upload never returned to |
| Shop details | Home, Shop, storefront editor, Look sheet, brand page | Home only with `from=home` | None | No | Five starts never returned to; no warning |
| Look picker, Storefront page | Storefront, Shop | Stays | None | No | Dead end |
| Brands and listing defaults | Product form (add brand), listing screen, sidebar | Stays | None | No | Opened mid-form with no way back to the form |
| Order detail | Orders list (filtered) | Stays | Fixed `/orders` | No | Tab and search lost |
| Open shop | Org index | New shop Home | None | No | Dead end |

## Admin
| Feature | Opened from | Finish goes | Back / Cancel goes | Warns | Gap |
|---|---|---|---|---|---|
| Order detail | Orders (filtered), Pickups, Refunds, Not packed, dashboard, shop Orders tab | Stays | Fixed `/admin/orders` | — | Seven starts, one Back |
| Add product for a shop | Shop page | `/admin/products/[id]` | `/admin/products` | Yes | Leaves the shop on both paths |
| Product view | Products, shop Products tab | — | Fixed `/admin/products` | — | Loses the shop |
| Edit product | Product view | Stays, toast | Product view | Yes | No return after save (Q8) |
| Bulk categories | Categories | Plain link | None | No | Dead end |
| Channel register, channel type | Channels, channel | Stays | None | No | Dead ends, two levels deep |
| Product types new / edit | List | Fixed list, no toast | Back → list, Cancel → browser history | No | Back and Cancel disagree |
| Categories new / edit | List | Fixed list after 500 ms, no toast | Back honours `returnUrl`, Cancel doesn't | Draft only | Back and Cancel disagree; filters lost |
| Offers new / edit | List | Fixed list | Cancel only | No | Filters lost; no header Back |
| Banners | List | List | List | No | Warning only |
| Org dialog, shipping credentials dialog | Orgs, Providers | Closes | Outside click discards | No | Typed input lost |
| Users, Requests, Payouts detail | Filtered lists | Stays | Fixed list | No | Filters, tab, page lost |
| Settings (fee, enhancements, terms) | Sidebar | Stays | — | No | Warning only |

## Store and sign-in
| Feature | Opened from | Finish goes | Back / Cancel goes | Warns | Gap |
|---|---|---|---|---|---|
| Checkout (Buy now) | Product page | Order page | Fixed `/cart` | No | Back lands on a bag without the item |
| Checkout sign-in | Checkout | Stays | — | No | Typed guest address thrown away |
| Portal sign-in pages | Org and admin layouts, middleware | `callbackUrl` | Browser only | — | Always portal home, not the deep page; query dropped |
| Reset password, verify email | Email links | Fixed `/signin`, `/` | — | — | Original page lost |
| Sign out | Menu | Fixed `/` | — | — | Leaves a public page needlessly (Q10) |
| Guest order lookup, guest order page | Orders | Inline summary | None | — | Dead end |
| Profile, address, review edits | Profile, product page | Closes (no toast) | Cancel | No | Warning and toast missing |

What already meets the rule, to copy: the admin order peek and the seller Listings details panel keep
the list's address when closed; the wishlist heart finishes its action after sign-in; sign-in pages
accept only our own paths.
