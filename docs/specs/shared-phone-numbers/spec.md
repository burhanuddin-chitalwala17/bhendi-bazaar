# Spec — shared-phone-numbers

- **Status:** Implemented
- **Domain:** identity
- **Phase:** — (cross-cutting)
- **Verified:** 2026-09-12
- **References:** [trd.md](trd.md), [ADR-0024](../../adr/0024-phone-is-contact-data-not-an-identity-key.md), [international-phone](../international-phone/)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is
One phone number can back any number of accounts. Giving a number that someone else has already given is not a reason to refuse an account or a profile change.

## Why
A phone number belongs to a device and a household, not to an account. One number is the only one in a family; one number is the counter of a shop where several people sell; one buyer orders for a relative who has no phone at all. Each of those is a separate account with its own cart, orders and addresses, and each has a real reason to give the same number as the one we should ring about a delivery.

Refusing the second of them produced a dead end rather than a choice: the message named a number the person genuinely holds, offered no way to prove they hold it, and the account already using it may be one they have never heard of. We ask for a phone so a courier can call. That is a contact detail, and contact details are shared.

## Requirements
- R1 — Signing up with a phone number another account already uses succeeds.
- R2 — Saving a profile with a phone number another account already uses succeeds.
- R3 — A phone number is still checked for being a real, dialable number for its country. What is dropped is exclusivity, not validity.
- R4 — Email remains what identifies an account, and signing in is unaffected.
- R5 — Nothing in the product claims to find *the* account for a phone number. A number may match none, one, or many.

## Product acceptance
- A1 — Two accounts can be created from one phone number, in a single sitting, without either being refused.
- A2 — Both accounts' delivery contacts, orders and confirmation emails show that number, formatted identically.
- A3 — Signing in with either account's email works exactly as before, and neither account can reach the other's data.
- A4 — An invalid number is still refused inline on the field, on a ~360px phone ([ADR-0015](../../adr/0015-mobile-first-design.md)).
- A5 — Admin user search on that number returns both accounts rather than one.

## Out of scope (this feature)
- Signing in by phone, OTP delivery, and account recovery by number — all assume one number names one account, which this feature makes false. Blocked on a decision, per ADR-0024 decision 5.
- Merging or de-duplicating accounts that share a number. Sharing is now expected, so there is nothing to merge.
- Any abuse control that rested on a phone number being scarce; see the ADR's consequences.
- How phone numbers are spelled and stored — that is [international-phone](../international-phone/), which stands unchanged.
