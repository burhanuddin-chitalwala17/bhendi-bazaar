# TRD — international-phone

- **Status:** Implemented
- **Domain:** cross-domain (identity, catalog, checkout)
- **Phase:** — (cross-cutting)
- **Verified:** 2026-09-11
- **References:** [spec.md](spec.md), [ADR-0013](../../adr/0013-one-error-envelope-and-useserverform.md), [ADR-0015](../../adr/0015-mobile-first-design.md), [ADR-0022](../../adr/0022-design-decisions-go-through-tokens.md)

> Technical approach and decisions. No code — references to existing code only.

## Approach
One module owns what a phone number is: `server/shared/phone.ts`, beside `server/shared/pincode.ts` and for the same reason — the rule had four copies that disagreed, and the server's were among the laxest. Schemas normalise to E.164 through it, one input component emits E.164 into every form, and the database is backfilled once.

Before this change, `common.schemas.ts` required a 6–9 leading digit while `address.schema.ts`, the guest checkout schema and `order.service.ts` accepted any ten digits; `profile.service.ts` had its own copy and `shipping/utils/validators.ts` an unused one.

## Technical decisions
- D1 — **`libphonenumber-js` with `max` metadata.** `min` validates most countries by length only and accepts `0123456789` as Indian, which the previous rule refused. `max` is 39 KB gzip against `min`'s 19 KB, loaded only where a phone is parsed. Hand-written per-country rules were rejected: lengths vary within a country and numbering plans change.
- D2 — **Stored as E.164 in the existing columns**, not as country and national columns. `User.mobile`'s unique index then compares one spelling. Before, seeded users held `+91…` and signup stored bare digits, so one number could hold two accounts. Razorpay's `contact` takes the same form.
- D3 — **Schemas normalise with a transform.** CONTRACTS.md rule 4 bars transforms for money because the schema runs on both sides (ADR-0013); normalising is idempotent, so the second run changes nothing. A test pins that.
- D4 — **A number without `+` is read as Indian** wherever one is parsed — schema, display, the input's initial value. That is what keeps pre-migration values, existing API callers and order snapshots working.
- D5 — **`Order.address` is not backfilled.** It is a snapshot (CONTRACTS.md § Addresses), and D4 displays both spellings identically.
- D6 — **The input emits E.164 even while incomplete** (`+91987`), so the error is "not valid for the selected country" rather than a formatting complaint.
- D7 — **The input keeps the user's own text on screen** and re-splits only when the value changes from outside, such as a reset or a restored draft; re-splitting its own echo would delete a typed trunk `0`.
- D8 — **`FormPhoneInput` reads its error from field state**, not an `error` prop, so it cannot be rendered without one. Other field wrappers are unchanged.
- D9 — `ProfileCard`'s account form was hand-rolled state; touching it converts it to `useServerForm` (ADR-0013 decision 7), and `ProfileContext` reads failures through `readApiError`, so a server phone error reaches the field.
- D10 — **`BidPanel`'s guest phone moves to `PhoneInput` without converting the panel to `useServerForm`.** Its several amount buttons and its own 409 handling make that conversion a rewrite of the bid submit flow; it is tracked on the BACKLOG error-envelope entry.

## Packages
`libphonenumber-js` — MIT, no dependencies. Imported only by `server/shared/phone.ts`. Row in [DEPENDENCIES.md](../../DEPENDENCIES.md).

## UI approach
At ~360px, one row: a country control showing `IN +91` at `h-9`, then the number field taking the remaining width. The control is a native `<select>` laid transparently over its label, so a phone opens its OS picker, and screen readers hear "Country code" with the country's full name. No flag emoji, which Windows renders as letters. The number field keeps `Input`'s 16px base with `type="tel"` and `autocomplete="tel"`. Desktop adds nothing. Tokens only (ADR-0022).

## Data model
[MIGRATION] `20260911120000_phone_numbers_e164`, data only. It prefixes `+91` to bare 10-digit values in `User.mobile`, `UserAddress.phone`, `OrgAddress.contactPhone`, `Org.phone` and `Bid.guestPhone`. A user whose `+91` spelling is already taken is skipped rather than failing the deploy, and the number of values left outside E.164 is raised as a notice.

## API / contract changes
[CONTRACT] Phones cross the wire as E.164. Input accepts any valid spelling, and bare digits still parse as Indian, so existing callers keep working. Recorded in [CONTRACTS.md](../../CONTRACTS.md) § Phone numbers.

## Test plan
- `tests/unit/phone.test.ts` — normalisation, the Indian rule kept, idempotent transform, display, split and join, migration clauses.
- `tests/unit/phone-input.test.tsx` — typing, country change, paste, trunk prefix kept on screen, external reset.
- `tests/unit/org-locations.test.ts` and `org-schema.test.ts` pass unchanged.

## Delivery (PRs)
One PR. Forms, schemas and backfill must ship together: forms emitting E.164 against a server still requiring ten digits would refuse every save.

## Open questions
None. What a courier accepts for a phone belongs to [shipping-fulfilment](../shipping-fulfilment/).
