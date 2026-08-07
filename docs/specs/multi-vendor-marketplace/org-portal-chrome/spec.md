# Spec — org portal chrome

- **Status:** Not drafted — scope agreed, requirements provisional, no TRD yet
- **Domain:** cross-domain
- **Phase:** 3 — Fulfilment
- **Verified:** 2026-08-08
- **Depends on:** portal-separation
- **References:** [../spec.md](../spec.md), [../data-model.md](../data-model.md)

> Requirements and product approach only. A `trd.md` is written when this subfeature is picked up.

## What this feature is
You can always see which organisation you are acting for, and change it.

## Why it is separate
Replaces the hardcoded title in `src/admin/sidebar.tsx` with a switcher, and adds the header bar the panel currently lacks.

## Requirements (provisional)
- **R1** — The portal shows the current organisation's name where the fixed store name is shown today.
- **R2** — A person belonging to more than one organisation can switch, and switching does not change what another open tab is showing.
- **R3** — The portal shows who is signed in, and offers a way to sign out and to return to the storefront.
- **R4** — A person belonging to exactly one organisation is not asked to choose.
