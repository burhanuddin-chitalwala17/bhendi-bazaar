# Spec — org onboarding

- **Status:** ✅ Implemented — PR-28
- **Domain:** catalog, identity
- **Phase:** 3 — Fulfilment
- **Verified:** 2026-08-09
- **Depends on:** organisations-and-membership, portal-separation (the org portal it lands in)
- **References:** [trd.md](trd.md), [../spec.md](../spec.md), [../portal-separation](../portal-separation/)

> Requirements and product approach only. Technical approach lives in [trd.md](trd.md).

## What this feature is
Someone with no organisation can start one from the store itself and arrive in a working portal as its
first owner, without anyone's help.

## Why
Every path into selling runs through membership of an organisation, and memberships are deliberately
never backfilled or guessed. Without self-serve creation the marketplace has a locked front door: the
only vendors are ones a platform admin types in by hand, which is a directory, not a marketplace.

## Requirements
- **R1** — The selling portal is reachable from the storefront's account menu. Nobody types a URL.
- **R2** — A person with no organisation who opens the portal is offered creation, not an error.
- **R3** — Creation asks only what the person genuinely decides: who the organisation is, how to reach it, and where it ships from. Anything the system can decide — its code, whether it is active — is never asked.
- **R4** — The creator becomes the organisation's first owner, and the organisation with its first membership exist together or not at all.
- **R5** — A person who already has organisations can create another, and one with exactly one is never asked to choose.
- **R6** — A failure names the field at fault, inline, like every other form in the store.

## Product acceptance
- **A1** — Sign in → account menu → Org Portal → create → land in the new portal as owner. One sitting, no admin involved.
- **A2** — The creation form has no code field and no active/inactive control.
- **A3** — Two organisations created with identical details do not collide — codes are assigned, distinct, and never change afterwards.
- **A4** — Someone belonging to one organisation who opens the portal is inside it without an intermediate screen; someone with two gets a chooser that also offers creating another.
- **A5** — If creation fails partway, no organisation and no membership exist.

## Out of scope (this feature)
- **Inviting or managing members** — [../org-team](../org-team/).
- **The switcher and header inside the portal** — [../org-portal-chrome](../org-portal-chrome/). The menu entry here is the way *in*; what it looks like once inside is chrome.
- **Approval or verification.** Creation is self-serve and immediate; `isVerified` exists on the record and nothing gates on it yet, per the programme spec.
- **A public vendor page or org slug.** No public identity exists yet; if one arrives, its slug question is decided then.
