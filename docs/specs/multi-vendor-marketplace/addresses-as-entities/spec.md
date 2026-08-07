# Spec — addresses as entities

- **Status:** Not drafted — scope agreed, requirements provisional, no TRD yet
- **Domain:** identity, catalog
- **Phase:** 3 — Fulfilment
- **Verified:** 2026-08-08
- **Depends on:** —
- **References:** [../spec.md](../spec.md), [../data-model.md](../data-model.md)

> Requirements and product approach only. A `trd.md` is written when this subfeature is picked up.

## What this feature is
An address is a record with columns, not a field inside a JSON blob.

## Why it is separate
Replaces `Profile.addresses` (`Json?`) with real tables. Independent of the portal work and a prerequisite for pickup locations.

## Requirements (provisional)
- **R1** — A postal address is stored once, identity-agnostic, and referenced by whoever needs it.
- **R2** — A buyer's address book entry carries its own recipient name and phone, because the person receiving is not always the account holder.
- **R3** — A recipient name, phone and state are required — an address a courier cannot use is not an address.
- **R4** — An order's delivery address does not change when the buyer later edits the address it came from.
- **R5** — Nothing is preselected: a buyer chooses an address at checkout.
