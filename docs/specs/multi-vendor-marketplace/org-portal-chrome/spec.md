# Spec — org portal chrome

- **Status:** ✅ Implemented — PR-31
- **Domain:** cross-domain
- **Phase:** 3 — Fulfilment
- **Verified:** 2026-08-09
- **Depends on:** portal-separation
- **References:** [trd.md](trd.md), [../spec.md](../spec.md), [../org-onboarding](../org-onboarding/)

> Requirements and product approach only. Technical approach lives in [trd.md](trd.md).

## What this feature is
Inside the portal you can always see which organisation you are acting for and who you are signed in
as, change the former, and leave.

## Why
Acting for the wrong organisation is the quiet failure this programme is built to prevent, and the
last line of defence is a person glancing at the screen. The portal borrowed its frame from the old
admin panel, which never needed to answer "as whom?" — one store, one operator. A multi-org portal
does.

## Requirements
- **R1** — The current organisation's name is always visible where the store's own name used to sit.
- **R2** — Someone acting for several organisations can switch from that same spot, staying on the section they were in; switching in one browser tab changes nothing in another.
- **R3** — Someone with exactly one organisation sees its name, not a switcher pretending there is a choice.
- **R4** — The portal shows who is signed in, and offers sign-out and a way back to the storefront.
- **R5** — The platform admin panel shows the same identity header, so the two panels cannot drift on something this basic.

## Product acceptance
- **A1** — With two organisations, switching from the products page of one lands on the products page of the other.
- **A2** — Two tabs on two organisations stay on two organisations.
- **A3** — With one organisation, no switcher control is rendered.
- **A4** — Sign out from either portal lands on the storefront, signed out.
- **A5** — The switcher also offers creating another organisation.

## Out of scope (this feature)
- Team management — [../org-team](../org-team/).
- Any notification, search, or breadcrumb apparatus in the header. It exists to answer "who am I, acting as whom" and nothing else yet.
