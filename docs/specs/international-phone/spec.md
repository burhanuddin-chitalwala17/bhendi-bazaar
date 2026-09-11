# Spec — international-phone

- **Status:** Implemented
- **Domain:** cross-domain (identity, catalog, checkout)
- **Phase:** — (cross-cutting)
- **Verified:** 2026-09-11
- **References:** [trd.md](trd.md), [ADR-0013](../../adr/0013-one-error-envelope-and-useserverform.md), [ADR-0015](../../adr/0015-mobile-first-design.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is
Every form that asks for a phone number accepts a number from any country, with India preselected.

## Why
Buyers abroad place orders for family in India, and organisations can have contacts outside it. A field that accepts only a 10-digit Indian mobile turns those people away at the last step, with a message saying their number is wrong when it is not.

## Requirements
- R1 — Every phone field — account mobile, saved and guest delivery addresses, organisation phone, pickup contact, a guest bidder's phone — accepts a valid number from any country.
- R2 — India is preselected, so an Indian buyer types exactly what they typed before.
- R3 — A number is checked against its own country's rules, identically in the browser and on the server, and a failure shows on the field.
- R4 — One number is one number however it was typed: it cannot hold two accounts, and it displays the same way everywhere.
- R5 — Pasting or autofilling a full international number selects its country.
- R6 — Numbers already on file, including those on past orders, keep working and display in the new format.

## Product acceptance
- A1 — On a ~360px phone the country code and number share one row, tapping the code opens the phone's own picker, and the number field does not zoom on focus.
- A2 — `98765 43210` typed with India selected and `+91 9876543210` pasted save as the same number.
- A3 — A UK number `020 7946 0958` saves with United Kingdom selected and displays as `+44 20 7946 0958`.
- A4 — `12345` is refused on the field, before submit.
- A5 — An existing account's mobile shows as `+91 98765 43210` on the profile and in admin.

## Out of scope (this feature)
- Proving a buyer owns the number (OTP).
- Asking for a phone at signup, which does not happen today.
- What a courier accepts for a non-Indian contact — booking is deferred with [shipping-fulfilment](../shipping-fulfilment/), and tracked on the [BACKLOG](../../BACKLOG.md) watch list.
