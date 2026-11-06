# TRD — setup-requests

- **Status:** Implemented
- **Domain:** a new `requests` domain, with listing (the setup it applies) and channels (the errors it hears)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-05
- **References:** [spec.md](spec.md), [ux.md](ux.md), [decisions.md](decisions.md), marketplace-publish [Q24, Q25](../marketplace-integration/marketplace-publish/decisions.md), [ADR-0052](../../adr/0052-a-product-type-is-a-row-that-selects-from-facts-declared-in-code.md), [ADR-0055](../../adr/0055-an-admin-surface-reads-through-projections-and-writes-through-the-aggregates-one-repository.md), [ADR-0038](../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
A ticket is a row keyed by what fixes it, not by who hit it. Each shop's need is a second row that
points at that ticket, so a hundred shops are one ticket and a hundred needs (Q9). Kinds are
plug-ins behind one interface: each knows its key, its words for each side, its plan, its apply and
how to tell it is done. The engine never branches on a kind. Errors reach the engine as a batch from
the places channels already sees them, written in one statement; the inbox and the shop read
projections. Apply goes through listing's own repositories in one transaction.

## Prior art
- **ITIL incident and problem; Zendesk problem tickets** (Q9): many incidents link to one problem;
  solving it solves them. We follow it: needs are incidents, tickets are problems.
- **Sentry issue grouping**: an event is fingerprinted, events with the same fingerprint join one
  issue, a resolved issue that sees the event again *regresses*. We follow it exactly: the ticket's
  key is the fingerprint (D3), reopening is Sentry's regression (Q12).
- **Amazon's Product Type Definitions API**: the source of truth for what a type requires and
  allows. We read it (already, for variation themes) through the home brand's connection (Q14).
- **Our own outbox jobs** (`stock-changed`): a write that must start work enqueues inside its
  transaction. We follow it for "a ticket resolved".

## Technical decisions
- **D1 — A new `requests` domain** (`server/requests/`). Tickets serve channels today and other
  audiences later (Q20); in channels they would carry a second reason to change. It reads listing
  and channels through their public surfaces only, and they call it, never its repositories.
- **D2 — Two tables.** `Ticket`: type (requirement, issue), kind, key, status (open, done, closed),
  subject (the kind's own small JSON: channel, their type, fields), timestamps for opened, resolved,
  reopened. `TicketNeed`: ticket, org, product (nullable), the error's own detail (nullable JSON),
  and for an issue the category and words; unique on (ticket, org, product). The admin's projection
  never selects `TicketNeed` columns but a count (Q3); the issue projection does (Q22).
- **D3 — The key is the fingerprint.** `{kind}:{channel}:{subject}` (`amazon-fields:amazon:TOTE_BAG`,
  `amazon-category:amazon:bag`, `issue:amazon:TOTE_BAG:purchasable_offer:90220`), unique. Raising is
  `INSERT … ON CONFLICT (key) DO UPDATE` that reopens a done ticket and merges new fields into its
  subject, so two shops at once make one ticket (hazard *two shops*).
- **D4 — Kinds are plug-ins** in `server/requests/kinds/`: `{ kind, type, keyOf, shopLine, adminTitle,
  plan, apply, isResolved }`. Two requirement kinds (Q10) and one issue kind. A new kind is a file
  and a registry line (Q16, Q17, Q20).
- **D5 — Errors reach the engine in batches.** Channels already sorts each complaint (marketplace-
  publish Q24's `fixesOf`). Its admin bucket and `otherIssues` become `needs`, handed to
  `requestService.raise(needs[])`, which writes every ticket in one statement and every need in a
  second. Callers: the listing screen's draft answer, a send's answer, the daily problems look (two
  more statements per run, not per shop; hazard *cost*), and readiness's "no Amazon category".
- **D6 — What Apply can do without code** (Q32): per field, **reuse** (map to a fact the type asks),
  **add** (a declared fact the type does not ask yet, added to the type), **from the product** (SKU,
  name, brand), **fixed** (a constant for that Amazon type), or **not possible** (no declared fact
  fits: an issue is raised for it). From-the-product and fixed live in a new `ChannelAttributeFill`
  (channel, their type, their attribute, source or constant), not as a nullable `fact` on
  `ChannelAttributeMap`: a null there would escape its unique rule, and every reader assumes a fact.
  A create sends fills beside facts (`forwardAttributes`).
- **D7 — The plan is computed, then frozen.** `plan()` reads Amazon's definition for the type
  through the home brand's connection and our register, and proposes one solution per field
  (match by name and by Amazon's allowed values against each list). The preview carries a hash of
  its inputs; Apply recomputes it and refuses with the new plan if it differs (hazard *stale*).
- **D8 — Apply is one transaction** through listing's repositories (`channelMapRepository`,
  `productTypeRepository`, `listingValueRepository`), each command gaining an optional `tx`. The
  ticket moves to done in the same transaction only where `status = open` (hazard *two taps*);
  a second Apply reads done and answers "Already set up".
- **D9 — Done is checked, not claimed** (Q8). The same daily pass drops needs whose product left sale
  and closes tickets left with none (Q13), one statement for every shop. `isResolved(subject)` reads the register. Run on
  every Apply, on every inbox open for the tickets it shows, and in the daily pass for all open
  requirements in one read. A ticket resolved by hand in the channel register closes there.
- **D10 — The home brand is configuration**: `HOME_BRAND_ORG_ID`, read once in
  `server/requests/marketplace/home-brand.ts`. Channels gains `connectionToken(orgId, channel)` returning a
  token source, never the token. Missing or not connected: plan says so; Apply of a manual choice
  still works (ux "not connected").
- **D11 — The line between sides is enforced in types and tests** (hazard *leaking*): the admin
  requirement DTO has no org, product or words field; a unit test asserts its keys. The shop DTO has
  no steps or plan field; same test.
- **D12 — The bell later.** Resolution enqueues `requests.resolved` inside its transaction; its
  handler today only stamps the needs' `notifiedAt`. PR #57's bell will read it (Q19).

## Packages
None.

## UI approach
Screens, states and copy are [ux.md](ux.md)'s; this says how they are built.
- **Phone first:** the inbox is a `ResourceList` (rows on a phone, a table from `md:`); detail is its
  own page on a phone and beside the list from `md:`. Report a problem is a `HandoffSheet`.
- **Rendering:** every page is a server component reading a DAL (`requests.dal.ts`,
  `admin/requests.dal.ts`). Client leaves: Apply/Not now/Mark fixed buttons, the field rename
  input, the type picker, and the report form.
- **Behaviour:** `requestsApiClient.ts` (shop: raise by hand, report) and `adminRequestsApiClient.ts`
  (apply, not now, mark fixed, preview refresh), each through `useMutation`; the report through
  `useServerForm` with its schema in `src/lib/validation/schemas/requests.schema.ts`.
- **Surfaces:** `StatusBadge` for every chip; no new token.

## Gates touched
- New domain → `PUBLIC_SURFACE` gains `requests` (`request.service`, `request.types`).
- New `CLAUDE.md` (`server/requests/CLAUDE.md`) → `LIVING_DOCS`.
- New routes → `route-reachability` (each with its ApiClient) and `portal-boundary`
  (`/api/admin/requests/**` admin, `/api/org/[orgId]/requests/**` `withOrg`).
- New tables → `one-repository` (`ticket.repository.ts` is the one writer of both).
- A file reaching a third domain → `RECORDED` for `request.service` (listing, channels).
- Copy and paths → `hardcoded-copy` (`requests-copy.ts`, `ROUTES.admin.requests`).

## Data model
[MIGRATION] `Ticket`, `TicketNeed`, `ChannelAttributeFill` (unique on channel, their type, their
attribute; written by `channel-map.repository`). Nothing changed or dropped on existing tables.

## API / contract changes
[CONTRACT] New DTOs in `server/requests/request.types.ts`: `ShopTicketDTO`, `AdminRequirementDTO`,
`AdminIssueDTO`, `RequirementPlanDTO`. `ListingScreenDTO.fixes` gains the ticket's state on its admin
line. Routes: `POST /api/org/{orgId}/requests` (report or raise by hand),
`GET|POST /api/admin/requests/{id}` (preview, apply, not now, mark fixed).

## Test plan
- Unit: each kind's `keyOf`, `plan` against a stubbed Amazon definition and a register, and
  `isResolved`; the DTO key lists (D11); solutions per field (D6).
- Integration (disposable DB): two raises at once make one ticket; a double Apply writes once; a
  stale plan is refused; a resolved ticket reopens on the same error; the daily pass stays two
  statements (counted); Apply's register rows are what a create then sends.
- Mutations recorded per guard in the CHANGELOG.

## Delivery (PRs)
1. Schema, `requests` domain, repository, `raise` and the issue kind; unit + integration. No UI.
2. The two requirement kinds: `keyOf`, `plan` (definition read, matcher), `apply`, `isResolved`;
   fills sent on create.
3. Raising from channels: listing screen, send, daily look, readiness. **Changes behaviour** (shop
   sees With us).
4. Admin inbox and detail, Apply, Not now, Mark fixed.
5. Shop: How to fix it ticket line, products list chip, Channels "Your requests", Report a problem.
6. Docs, ARCHITECTURE, CONTRACTS, review.

## Open questions
None. Q32 decided 2026-11-05.
