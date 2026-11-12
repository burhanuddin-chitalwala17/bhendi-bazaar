# Spec — org-handle

- **Summary:** Every organisation gets a short, readable name that can appear in a URL
- **Status:** ✅ Implemented
- **Domain:** catalog
- **Phase:** 9 — Seller storefronts
- **Verified:** 2026-09-19
- **References:** [../spec.md](../spec.md) (programme), `431ed6e7:docs/specs/org-storefront/trd.md` D3–D3e, [ADR-0030](../../../adr/0030-org-storefronts-are-scoped-projections-on-one-domain.md), [Invariant 4](../../../../CLAUDE.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

Every organisation gets a short, readable name that can appear in a URL — `naaz-collection` rather than
`cmf3k2x9p0001` or `SEL-007`.

## Why

Nothing an organisation has today can be put on a card. `Org.code` is a ledger identifier and `Org.id` is a
cuid; neither reads as a shop. Every other subfeature needs an address before it can exist, and the address
has to be one a seller is willing to promote.

A handle is generated at creation so nothing is asked of an owner on day one, and it can be changed
afterwards, because a public address an algorithm chose for a business should not be permanent.

That freedom is only safe with a memory. A handle appears on cards, posters and paid advertisements that
cannot be recalled, so a change must **add** to what resolves rather than replace it. Without that, a
rename is a silent outage the owner cannot see and the platform hears about as a support message.

That memory is a holding period. When a handle is retired it is **held for 180 days**: it redirects to the
organisation's current handle, and nobody else can be issued it. Links still circulating keep working, and
the organisation can take it back. After that it is **released** — it stops redirecting and returns to the
pool for anyone.

Releasing is the deliberate half. Handles recirculate instead of piling up against shops that stopped using
them, and a business that folds frees its name for the next one. The price is real and worth naming: once a
handle is released, a card printed two years ago can carry a customer to a **different shop**, with nothing
to tell them it happened. The 180 days is the only thing standing between those two outcomes, which is why
it is a setting rather than a number in the code.

## Requirements

- **R1** — Every organisation has exactly one handle, and no two organisations share one.
- **R2** — A handle is readable and pronounceable: lowercase letters, digits and hyphens, short enough to say aloud.
- **R3** — A handle is derived from the organisation's name when the organisation is created, without anything being asked of the owner.
- **R4** — An organisation may change its handle. The new one becomes its address immediately.
- **R4a** — A handle an organisation has retired keeps sending visitors to that organisation for 180 days after the change. A link printed the month before still arrives.
- **R4b** — For those same 180 days no other organisation can be issued that handle, so the organisation that left it can take it back.
- **R4c** — That window is a setting, not a fixed fact. Changing how long a handle is held is a configuration change, never a code change.
- **R4d** — After the window the handle is released: it stops sending anyone anywhere, and another organisation may be issued it.
- **R4e** — A released handle that nobody has taken says it is not found, rather than claiming to be permanently gone — it may yet belong to someone.
- **R4f** — Taking a handle back never strands a visitor in a loop between the handle being resumed and the one being left.
- **R4g** — An owner changing a handle is warned before it happens, not told afterwards. The warning is explicit about all four consequences: the old address keeps working for 180 days and then stops; after that it may be issued to another organisation, so an old link could one day take their customers to a different shop; anything already printed, paid for or posted needs updating; and whatever search ranking the old handle had does not fully transfer.
- **R4g1** — The warning names the actual handles and the actual date the old one stops working, not a generic caution. Confirming is a deliberate act, distinct from saving an ordinary edit.
- **R4h** — Renaming an organisation does not move its handle. Only an explicit handle change does.
- **R5** — Two organisations with the same or similar names both get a working, distinct handle, without anybody being asked to resolve it. A handle currently held by another organisation counts as taken; a released one does not.
- **R6** — A handle changes only through an explicit, authorised operation of its own — never a field on a general organisation update, never chosen by the caller at creation, and never by anyone but that organisation's owner or a platform administrator.
- **R6a** — At any moment an organisation has exactly one current handle, and it is what every page, link, preview and sitemap entry uses.
- **R7** — Every organisation that already exists has a handle before anything is allowed to link to one.
- **R8** — A handle cannot collide with a path the platform already serves, or one it plausibly will.
- **R9** — A handle survives a name that is not in the Latin alphabet, and a name that is only punctuation.

## Product acceptance

- **A1** — Creating an organisation called "Naaz Collection" produces `naaz-collection` with nothing further asked of the owner.
- **A2** — Creating a second organisation with the same name produces a different, still-readable handle.
- **A3** — Renaming "Naaz Collection" to "Naaz Couture" leaves the handle alone until the owner chooses to change it.
- **A3a** — A link followed five months after a handle change reaches the shop, and the address bar shows the new handle.
- **A3b** — The same link followed seven months after the change does not reach the shop.
- **A3c** — An organisation that changed handle two months ago can change back, and every link built on the old one works again.
- **A3d** — While a handle is held, no other organisation can be issued it.
- **A3e** — Changing back does not leave the two handles pointing at each other; a visitor on either lands on the shop.
- **A3f** — An owner about to change a handle is shown the old and new handle, the date the old one stops working, and that it may later belong to someone else — and has to confirm past that, not merely save a form.
- **A3g** — An owner who reads the warning and backs out changes nothing.
- **A4** — No organisation exists without a handle after this ships.
- **A5** — An organisation named "شمع" or "…" still gets a usable handle rather than an empty one, and its owner can replace it with something they like.
- **A6** — Posting a handle to a general organisation update endpoint changes nothing.
- **A7** — A member who is not an owner cannot change their organisation's handle.

## Out of scope (this feature)

- Anything that renders a handle — see [seller-identity](../seller-identity/) and [storefront-pages](../storefront-pages/).
- Redirect history for **product** slugs. Handles get it here; `Product.slug` stays frozen under [Invariant 4](../../../../CLAUDE.md), and the slug-redirects entry in [BACKLOG.md](../../../BACKLOG.md) is untouched by this.
- Reserving handles ahead of signup, and vanity or reserved handles as a tier.
- Reclaiming a handle from the organisation currently holding it. The hold expires on its own; nothing shortens it.
- Limiting how often a handle may change. Deliberately unconstrained for now — a rate limit layers on later without disturbing any of the above.
