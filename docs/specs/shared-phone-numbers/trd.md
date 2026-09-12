# TRD — shared-phone-numbers

- **Status:** Implemented
- **Domain:** identity
- **Phase:** — (cross-cutting)
- **Verified:** 2026-09-12
- **References:** [spec.md](spec.md), [ADR-0024](../../adr/0024-phone-is-contact-data-not-an-identity-key.md), [ADR-0014](../../adr/0014-deploys-run-their-own-migrations.md), [international-phone](../international-phone/trd.md)

> Technical approach and decisions. No code — references to existing code only.

## Approach
The rule existed in four places enforcing one constraint: the unique index `User_mobile_key`, and three application checks that duplicated it ahead of time. All four go. Nothing is added in their place, because the requirement is the absence of a rule rather than a new one.

Authentication is untouched. `src/lib/auth-config.ts` resolves a credential login by email and has never consulted `mobile`, so exclusivity was protecting nothing that signs anyone in.

## Technical decisions
- D1 — **The index is dropped, not made non-unique.** After the three checks go, no query looks a mobile up exactly; the only remaining reader is the admin user search, which is `contains` (`server/identity/admin.user.repository.ts`) and cannot use a btree. A plain index would be an unused write cost.
- D2 — **Validity is kept, exclusivity removed.** `profile.service.ts` still rejects an unparseable number through `isValidPhone`; only the `ConflictError` beside it goes. The two were adjacent and easy to mistake for one check.
- D3 — **The duplicate check in `profile.repository.ts` goes rather than being kept as a backstop.** It re-read the user and re-queried to reproduce what the service had already decided, which is the shape ADR-0003 warns about; a repository enforcing a policy is how the policy comes to have two versions.
- D4 — **Signup narrows to a typed `findUnique` on email.** Its hand-built `OR` needed `as any` to hold an optional clause — an `any` on an auth path, which CLAUDE.md treats as a defect. Removing the mobile arm removes the cast with it.
- D5 — **The migration finishes the E.164 backfill.** `phone_numbers_e164` skipped any user whose `+91` spelling was taken, solely because this index would have refused it, leaving those rows outside the E.164 every reader assumes. The `NOT EXISTS` guard has no reason to exist once the index is gone, so the same `UPDATE` runs without it, after the `DROP`. The count still outside E.164 is raised as a notice rather than failing the deploy.
- D6 — **No data is deleted or merged.** Accounts that already share a number — which existed, since `mobile` is optional and seeded users differed in spelling — simply stop being anomalous.

## Packages
None.

## UI approach
None. No form, field or layout changes: `PhoneInput` and `FormPhoneInput` are untouched, and the only user-visible difference is a 409 that no longer happens. The signup 409 that remains names email alone, so its message drops "or mobile".

## Data model
[MIGRATION] `20260912090000_phone_is_not_an_identity_key`. Drops `User_mobile_key`, then completes the `+91` backfill on `User.mobile` for bare 10-digit values, then raises a notice with what is still outside E.164. `User.mobile` stays `String?`. No other table is touched — `UserAddress.phone`, `OrgAddress.contactPhone`, `Org.phone` and `Bid.guestPhone` were never unique. Applied by `prisma migrate deploy` on deploy ([ADR-0014](../../adr/0014-deploys-run-their-own-migrations.md)).

## API / contract changes
None. No DTO changes shape: phones still cross the wire as E.164 exactly as [CONTRACTS.md](../../CONTRACTS.md) § Phone numbers describes, and that section never claimed exclusivity. A client that handled the 409 still compiles; it simply stops receiving one for a phone.

## Test plan
`tests/unit/phone.test.ts` gains a block pinning the change where it can actually be pinned without a database: that `User.mobile` carries no constraint while `email` keeps `@unique`, that the migration drops the index rather than recreating one, and that the completed backfill carries no collision guard. The existing block over `phone_numbers_e164` is left alone — that file is history and still describes what it did.

## Delivery (PRs)
One PR. The migration and the three application checks must ship together: dropping the checks against a database still holding the index turns a handled 409 into an unhandled Prisma `P2002`.

## Open questions
None. Phone-based sign-in and recovery are deliberately out of scope and blocked on their own ADR — see spec.md.
