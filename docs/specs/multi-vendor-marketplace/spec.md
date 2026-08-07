# Spec — multi-vendor marketplace

- **Status:** Draft — programme overview; each subfeature carries its own spec and TRD
- **Domain:** cross-domain
- **Phase:** 3 — Fulfilment, reaching back into Phase 2
- **Verified:** 2026-08-08
- **References:** [data-model.md](data-model.md), [consumer-inventory.md](consumer-inventory.md), and the subfeatures below

> Requirements and product approach only. Each subfeature's technical approach lives in its own `trd.md`.

## What this is

The store becomes a marketplace with three audiences: people who buy, organisations that sell, and the
people who run the platform. Each gets its own portal, and the panel that exists today splits between
the second and third.

## Why one programme rather than one feature

This began as a question about where a product ships from. Answering it properly turned out to require
an owner for a pickup location, which required an organisation, which required people to belong to one
— and at that point the panel that had been called "admin" was doing two unrelated jobs for two
different audiences. The data-model work and the portal work are the same change seen from two sides,
which is why they share a parent, and why neither can be reviewed sensibly as a single document.

## Requirements

- **R1** — Signing in lands a person on the buying experience. Selling is somewhere they choose to go, not where they arrive.
- **R2** — A person can act for more than one organisation and switch between them, and it is always unambiguous which one they are acting for.
- **R3** — A person with no organisation is offered the chance to create one, and can complete that without help.
- **R4** — An organisation sees its own products, stock, orders and shipments, and no other organisation's.
- **R5** — An organisation's members can be listed, invited, given a role, and removed by someone entitled to do it.
- **R6** — Platform-wide work — every order, every organisation, every user, the shared category taxonomy, courier accounts — stays with the platform owners and is not reachable from an organisation's portal.
- **R7** — A buyer's order may contain items from more than one organisation, and neither the buyer's view of it nor any organisation's view of it is misleading about what the other can see.
- **R8** — Acting for an organisation is authorised against a current membership, checked on the request. Losing membership takes effect immediately, without signing out.

## Product acceptance

- **A1** — A new sign-in arrives on the storefront, with a way to switch to selling in the account menu.
- **A2** — Switching organisation changes what is listed without a reload ambiguity: two browser tabs can show two different organisations at once.
- **A3** — A person belonging to no organisation is prompted to create one and reaches a working portal at the end of it.
- **A4** — An organisation cannot reach another's products, orders or stock by editing a URL.
- **A5** — A platform owner still sees the cross-organisation views that exist today, unchanged.
- **A6** — An order spanning two organisations shows each of them only its own part, while the buyer sees the whole.
- **A7** — A member removed from an organisation is refused its portal on their very next action, with no sign-out required.

## Decisions taken (2026-08-08)

- **The category taxonomy is platform-owned.** Organisations choose from it and cannot add to it, so every vendor's ridas land in the same place and category pages stay meaningful.
- **Courier accounts are platform-wide.** One provider account, against which organisations register pickup locations. Credentials never reach an organisation's portal.
- **The active organisation lives in the URL**, not a session or a cookie. A request carries the organisation it is for, so acting on the wrong one is not an accidental state.
- **Two authorization axes, kept apart.** `User.platformRole` says whether someone runs the platform; a membership row says what they may do inside one organisation. Both exist; neither is expressed through the other.
- **Membership is read from the database on the request that needs it.** A claim baked into a sign-in token would keep granting access after a membership was revoked.
- **The dashboard is assembled from widgets that declare their audience**, and the declaration decides what is fetched rather than what is drawn.

## Subfeatures


| Subfeature                                                        | Requirement                                                  | Depends on                                |
| ----------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------- |
| [organisations-and-membership](organisations-and-membership/)     | A vendor is an organisation with people in it ✅ done         | —                                         |
| [portal-separation](portal-separation/)                           | Three audiences, three portals, one authorization model      | organisations-and-membership              |
| [org-onboarding](org-onboarding/)                                 | Someone with no organisation can create one                  | portal-separation                         |
| [org-portal-chrome](org-portal-chrome/)                           | You can see and change which organisation you are acting for | portal-separation                         |
| [org-team](org-team/)                                             | An organisation's people can be managed                      | portal-separation                         |
| [dashboard-widgets](dashboard-widgets/)                           | One dashboard, assembled from widgets that declare their audience | portal-separation                         |
| [addresses-as-entities](addresses-as-entities/)                   | An address is a record, not a JSON blob                      | —                                         |
| [category-tree](category-tree/)                                   | Categories nest to any depth                                 | —                                         |
| [order-and-cart-lines](order-and-cart-lines/)                     | What was bought is a relation, not a blob                    | money-as-paise                            |
| [stock-locations-and-allocation](stock-locations-and-allocation/) | Stock has a location; an order ships from where its stock is | the four above, and inventory-reservation |


## Out of scope (this programme)

- **Vendor settlement.** A marketplace normally owes each organisation money for what it sold, less commission. Nothing here calculates, records or pays that, and no requirement above implies it. It is the largest absent piece and needs its own feature before real vendors are onboarded.
- **Per-organisation branding, domains, or storefronts.** One storefront, many vendors.
- **Organisation-level permissions beyond a role on the membership.** The role makes authorization expressible; a permission matrix is a later feature if it is ever needed.
- **Vendor-facing analytics** beyond the lists in R4.
- **Approval or verification of a new organisation.** Creation is self-serve; `isVerified` already exists on the record and nothing gates on it yet.

