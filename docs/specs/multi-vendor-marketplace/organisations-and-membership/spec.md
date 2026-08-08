# Spec — organisations and membership

- **Status:** ✅ Implemented — PR-23 (rename) and PR-24 (membership)
- **Domain:** catalog, identity
- **Phase:** 3 — Fulfilment
- **Verified:** 2026-08-08
- **References:** [trd.md](trd.md), [../spec.md](../spec.md), [../data-model.md](../data-model.md), [../consumer-inventory.md](../consumer-inventory.md)

> Requirements and product approach only. Technical approach lives in [trd.md](trd.md).

## What this feature is
A vendor is an organisation with people in it, rather than a record an admin types on someone's behalf.
A person can belong to several, and an organisation can have several people.

## Why
Everything else in this programme needs an owner that is not a person. A pickup location belongs to a
business, not to whoever entered it; stock belongs to a business; an order line is fulfilled by a
business. Today the vendor record has no connection to any user account at all — nobody can act *as* a
vendor, because there is no relationship saying they may.

Modelling it as one user per vendor would be simpler and wrong in a way that is expensive to undo: a
shop is run by more than one person, staff change, and an owner who leaves should be removable without
the shop's products becoming unreachable. The relationship, not the record, is the thing that was
missing.

## Requirements
- **R1** — An organisation is a record in its own right, with a name, a code, and the business details a vendor needs.
- **R2** — A person can belong to more than one organisation, and an organisation can have more than one person.
- **R3** — Each membership carries a role, so a later decision about what each role may do has somewhere to live.
- **R4** — A person can hold at most one membership in any given organisation.
- **R5** — Removing a person from an organisation removes only the relationship. Neither the person's account nor the organisation's data is affected.
- **R6** — An organisation's products, locations and shipments remain attributed to it regardless of which people currently belong to it.
- **R7** — Nothing in the store refers to a vendor as a "seller" any more. The word is one thing in one place.

## Product acceptance
- **A1** — A person can be a member of two organisations at once and both are listed for them.
- **A2** — Adding the same person to one organisation twice is refused.
- **A3** — Removing the last member of an organisation leaves the organisation and its products intact.
- **A4** — An organisation's existing products, shipments and pickup locations are unchanged by the rename, and every page that listed sellers still lists the same rows.
- **A5** — A search of the codebase for "seller" returns nothing outside historical records.

## Out of scope (this feature)
- **The portals themselves** — [../portal-separation](../portal-separation/) owns route structure, landing rules and authorization. This feature only makes membership *expressible*.
- **What each role may do.** The role is stored; no code branches on it yet.
- **Creating an organisation from the interface** — [../org-onboarding](../org-onboarding/).
- **Managing members from the interface** — [../org-team](../org-team/).
- **Invitations.** A membership is created directly; invitation flow, acceptance and expiry belong to [../org-team](../org-team/).
- **Vendor settlement and commission**, which the programme excludes entirely.
