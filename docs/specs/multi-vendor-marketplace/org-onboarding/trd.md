# TRD — org onboarding

- **Status:** ✅ Implemented — PR-28
- **Domain:** catalog, identity
- **Phase:** 3 — Fulfilment
- **Verified:** 2026-08-09
- **References:** [spec.md](spec.md), [../organisations-and-membership/trd.md](../organisations-and-membership/trd.md), [../portal-separation/trd.md](../portal-separation/trd.md), [ADR-0007](../../../adr/0007-conditional-stock-decrement.md), [ADR-0013](../../../adr/0013-one-error-envelope-and-useserverform.md), [CONTRACTS.md](../../../CONTRACTS.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.
> Written after a first implementation had already landed reactively; recorded here so the decisions
> survive the session that made them. The process slip is noted in the CHANGELOG, not hidden.

## Approach
Creation is one route (`POST /api/orgs`), one transaction, and the same form the platform admin
already uses. The interesting decisions are all about what creation *refuses to ask*: the two fields
that used to be typed in — the code and the active flag — are server-owned, for the same reasons the
product slug is.

## Technical decisions
- **D1 — Org codes are server-generated and frozen; nobody is asked for one, admin included.** A shop owner asked to invent `TEST-001` produces collisions, typos, and an identifier that means nothing — and a code, once printed on an invoice, can never change, which is the slug lesson (PR-15/18) again. Format `ORG-` + 5 characters from an alphabet with no `0/O`/`1/I/L`, since codes get read aloud and typed from paper (`server/catalog/org.code.ts`). Existing `SEL-*` codes are untouched.
- **D2 — Uniqueness is settled by the constraint with retry, not a prior existence check.** The old `findByCode`-then-insert was a read-then-write race ([ADR-0007](../../../adr/0007-conditional-stock-decrement.md)'s reasoning applied to inserts). With generated codes a collision is an internal retry, never a user error, so the check-first pattern lost its only justification.
- **D3 — `isActive` is server-owned at creation.** A new org is active by definition; deactivation is a platform act on an *existing* org, so the flag is editable through `updateOrgSchema` and absent from `createOrgSchema` — Invariant 4's server-owned-fields rule, not a UX preference. The form's switch renders only in edit mode.
- **D4 — One form serves self-serve creation, admin creation, and admin edit.** The layouts are identical and only the fields differ by mode, so the form takes the superset (`orgFormSchema`) while each route parses its own stricter schema — a client can send `isActive` and the create route strips it. A second form would drift, which is the nine-forms lesson behind [ADR-0013](../../../adr/0013-one-error-envelope-and-useserverform.md).
- **D5 — Org + first membership is one transaction** (`createWithOwner`, already landed in PR-24's repository): an org nobody can administer is unreachable, and a membership pointing at an org that failed to create is nonsense.
- **D6 — `POST /api/orgs` requires a session, not a membership or a platform role.** It is the one org write `withOrg` cannot wrap — there is no org to be a member of yet — and requiring a platform admin would re-lock the front door the feature exists to open.
- **D7 — The entry point is a static menu item to `/org`**, which resolves state server-side: none → create prompt, one → straight in, several → chooser with a create-another link. The menu cannot know membership without a fetch on every render; the page already has to know it, so the page decides.

## Packages
None.

## Data model
None — `Org` and `OrgMember` landed in [organisations-and-membership](../organisations-and-membership/). No migration.

## API / contract changes
**[CONTRACT]** — `createOrgSchema` loses `code` and `isActive`; `updateOrgSchema` alone carries
`isActive`; `orgFormSchema` is the form's superset. `POST /api/orgs` is new.
[CONTRACTS.md](../../../CONTRACTS.md) unchanged beyond the envelope it already documents — these DTOs
are single-route shapes, which its own criteria leave to their Zod schemas.

## Test plan
Covered in `tests/unit/org-schema.test.ts`:
- A client-sent `code` or `isActive` is **stripped**, not trusted — the server-owned-fields assertions.
- Generated codes match their declared pattern, avoid the ambiguous characters in the random part, and do not repeat across 500 draws — so the retry loop is a rarity, not a routine.
- GST/PAN normalise case before validation; every optional field accepts the empty string a form actually sends.
- The transaction (A5) is database behaviour and **not automated** — no test database ([TESTING.md](../../../TESTING.md) § Database behaviour is currently untestable).

## Delivery (PRs)
One PR (PR-28), after the fact — see the CHANGELOG entry for what testing the portal found on the way.

## Questions carried forward
- Does an admin creating an org *for* someone need to name its first owner at creation? Today an admin-created org starts memberless, reachable only through [../org-team](../org-team/) once that exists.
- `contactPerson` remains on the record and the form; whether memberships make it redundant is [../org-team](../org-team/)'s question.
