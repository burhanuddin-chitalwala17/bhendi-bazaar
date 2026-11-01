# TRD — own-store/product-form

- **Status:** Implemented — 2026-11-01, units 1–6 (accepted 2026-10-30; UX signed off 2026-10-30; Q20–Q22 decided by the owner)
- **Domain:** catalog, with listing (readiness) and shared (audit)
- **Phase:** 12 — The shop's own store
- **Verified:** 2026-10-30
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](ux.md), [own-store](../decisions.md) (Q16, Q17), [bulk-sheet](../bulk-sheet/trd.md), [ADR-0003](../../../adr/0003-one-repository-per-aggregate.md), [ADR-0007](../../../adr/0007-conditional-stock-decrement.md), [ADR-0013](../../../adr/0013-one-error-envelope-and-useserverform.md), [ADR-0021](../../../adr/0021-audit-trail-never-fails-the-action.md), [ADR-0029](../../../adr/0029-a-product-leaves-sale-by-archiving-not-deletion.md), [ADR-0040](../../../adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md), [ADR-0046](../../../adr/0046-a-new-model-is-checked-against-the-field-before-the-codebase.md), [ADR-0048](../../../adr/0048-a-component-renders-a-hook-holds-state-an-api-client-makes-the-call.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md), [ADR-0055](../../../adr/0055-an-admin-surface-reads-through-projections-and-writes-through-the-aggregates-one-repository.md), [ADR-0057](../../../adr/0057-shared-hooks-live-in-one-core-folder-and-every-other-hook-travels-with-its-component.md)

> Technical approach and decisions. No code — references to existing code only.

## Approach
The one product form (`src/components/shared/forms/product/index.tsx`) keeps its schema, hook
and field components inside a step shell: five steps on create, five cards on edit. What is saved
changes only by a version, an editor and, for the team, a reason with before/after. The admin
gets the same form through thin admin handlers over the same catalog service.

## Prior art
- **Optimistic concurrency** is a version compared on write: HTTP `If-Match`/412 (RFC 9110),
  Rails `lock_version`, JPA `@Version`. Followed, in the body not a header, since
  `useServerForm` speaks bodies and the 409 envelope carries a message (ADR-0013).
- **Stepped listing with per-section error counts** (Amazon "Add a product", Shopify mobile) and
  **before/after audit rows** (PaperTrail `object_changes`) are followed, the latter in `AdminLog`.

## Technical decisions
- **D1 — A step shell (R1, R2, R7; Q2, Q4, Q7).** A pure map assigns every field to a step;
  "More options" is a closed disclosure in its step. "Next" never validates; only the save submits.
- **D2 — Errors live on their field; counts come from the same map (R4, R13; Q5, Q6).**
  `useServerForm` (`src/hooks/core/useServerForm.ts`) gains `onInvalid`, so the shell opens the
  first step with an error. Chip counts read client and server errors through the D1 map; the
  banners go. No button carries `disabled`; a second tap while saving is ignored.
- **D3 — Photos and video re-housed, rules unchanged (R14–R16; Q30–Q32, Q34, Q36).** Step 1 renders
  `src/components/product/product-media-manager.tsx` as it is: upload paths
  (`src/lib/image/upload-video.ts`), cover rule, cap, slots, states and copy. Only two changes:
  "Add" opens a three-row menu driving its existing input and link field, and at the cap Add stays
  tappable and shows `CAPACITY_NOTICE` (Q36). Its existing tests pass untouched.
- **D4 — Readiness hints from unsaved values (R5; Q8, Q31).** A new read
  `POST /api/org/[orgId]/products/readiness` fills the unsaved values as a save would
  (`server/listing/listing-fill.service.ts`), writes nothing, and answers
  `channelReadinessService.forProduct` (`server/listing/channel-readiness.service.ts`). Called on
  leaving a step and on Review; empty renders nothing; nothing of it reaches the submit path.
- **D5 — Category change names what is lost (R6; Q9).** A pure function lists answered facts the
  new type does not ask; a confirmation offers "Keep {old}". Answers stay in form state until
  submit, which drops facts the current type does not ask (all of them for a category with no type)
  before validating, so a field off screen never blocks a save — only when the category changed in
  this form, never on an edit that keeps it; `ProductFactFields.tsx` stops clearing.
- **D6 — Version compare-and-set (R9; Q11, Q35).** `Product.version` is bumped by every person
  save (form, team, sheet), not by marketplace fills or archive. The edit body carries
  `seenVersion`; `updateProduct` (`server/catalog/product.repository.ts`) opens its transaction
  with a guarded `updateMany` on (id, org, version) that bumps it, and count 0 is a
  `ConflictError` before stock, media or fields move. Stock keeps its per-row compare-and-set.
- **D7 — Who and when (Q35).** `lastEditedById`, `lastEditedAt`, `teamEditedAt` (set by a team
  save, cleared by a shop save) word the refusal: "Bhendi Bazaar team" or the member, and when.
- **D8 — Rebase (R9).** On the 409 a hook keeps the dirty fields, refreshes the page's props,
  resets to the latest product and re-applies and marks them. No new read route.
- **D9 — Device draft (R8; Q10).** `src/hooks/forms/useFormPersist.ts` gains a saved-at time; the
  key is per product on edit, and the draft keeps its `seenVersion`, so D6 refuses and D8 rebases
  it. A copy-from start is never restored; past 7 days it asks "Use it?".
- **D10 — Leave guard (R8).** `beforeunload`, a capture-phase listener on same-origin links, and
  one history entry pushed on first change so a back gesture opens the sheet.
- **D11 — Team saves (R10–R12; Q13, Q14, Q21, Q22).** The admin schema adds a required `reason`
  (3–200 chars); the org is the product's or the path's, never the body's. A new team service
  calls the same `productsService` commands with the admin as editor (ADR-0055), then
  `recordAdminAction` (`server/shared/audit/audit.service.ts`) with org, reason and each field's
  before/after, money first. A failed record never fails the save (ADR-0021); the badge is a column.
- **D12 — Admin routes (Q12).** Admin twins of the org routes the form uses (create, edit,
  restore, readiness, values, family, upload token and confirm) behind `requirePlatformAdmin`
  (`src/lib/admin-auth.ts`). An archived product refuses edit with "Restore" (ADR-0029).
- **D13 — The shop's view (R12; Q14, Q23).** Badge while `teamEditedAt` is set; history is a
  server read of the product's team entries, newest first, without the admin's name; the home
  line counts products with `teamEditedAt`.

## Hazards
| Hazard | Answer |
|---|---|
| Silent swap | Answered by D5 |
| Lost work | Answered by D9, D10 |
| Draft over copy | Answered by D9 |
| Two editors | Answered by D6, D7, D8 |
| Hidden errors | Answered by D1, D2 |
| Unrecorded help | Answered by D11, D13 |
| Video lost in the steps | Answered by D3 |
| Late refusal | Answered by D3 (Failed state unchanged; its reason on the row is parked as Q33) |

## Packages
None (cross-checked against [DEPENDENCIES.md](../../../DEPENDENCIES.md)).

## UI approach
Screens, states and copy are [ux.md](ux.md)'s. Rules: [src/components/CLAUDE.md](../../../../src/components/CLAUDE.md).
- **Phone:** one step per screen, chips on top, sticky bar above the tab bar; edit is stacked
  cards, a section full screen. **`md:`** a left rail; a section opens beside the cards.
  **`lg:`** a live buyer preview from the unsaved values (Q19).
- **Rendering:** pages stay server components passing DTOs; the form and shell are the client leaf.
- **Behaviour:** `productsApiClient.ts` (`src/components/product/console/`) gains the admin base;
  `listingApiClient.ts` (`src/components/product/`) gains readiness. Hooks beside the form: steps,
  readiness (`useAsyncData`), leave guard, rebase. Props stay `ProductDetails`/`ProductFormInput`.
- **Surfaces:** `ResponsivePicker` for category and "Add"; `FormDialog` for the two confirmations.

## Gates touched
`route-reachability`/`portal-boundary`: one org and eight admin routes (U5: create, edit, restore and five shop-scoped twins); `portal-boundary` now holds every admin product write to the team service. `rate-limit-registry`:
none, all under `/api/org` or `/api/admin` (ADR-0063). `one-repository`: new columns written only
in `product.repository.ts`. No `RECORDED` or `MAY_USE_SHEET` entry.

## Data model
- **U4 [MIGRATION]:** `Product.version` (Int, default 0), `lastEditedById` (nullable, Restrict),
  `lastEditedAt`, `teamEditedAt` (nullable). Additive; no backfill.
- **U5 [MIGRATION]:** `AdminLog` index on (resource, resourceId) for the history read.

## API / contract changes
[CONTRACT] U2: readiness preview request; response is the existing `ChannelVerdict[]`. U4: edit
input gains `seenVersion`; the org product DTO gains `version`, `lastEditedAt`, `lastEditedBy`
(name) and `teamEditedAt`; the 409 is a `ConflictError`. U5: admin input adds `reason`.
U6: `ProductTeamEditDto` (time, reason, ordered field changes; no admin identity).
[CONTRACTS.md](../../../CONTRACTS.md) moves in each.

## Test plan
Per [TESTING.md](../../../TESTING.md); each new guard is mutation-tested and recorded.
- **Unit:** the step map covers every field; answers lost (A4); money-first diff; conflict wording.
- **Integration:** a second save from one version writes nothing (A6; mutation: drop the version
  clause); a team save leaves one audit entry and the badge (A7), and saves when the audit fails.
- **Component:** A2, A5, A8 (no `disabled` in the tree), A9, A10. **Walked:** A1, A3 (Q18).
- **U1, verified manually at 360px:** the A9 Failed row and playback once ready (the worker's, unchanged
  by U1); the `lg:` preview beside the steps. U1 asserts A8 over the create steps; the edit sections
  are U4's.

## Delivery (PRs)
| Unit | Closes | Migrates | Contract |
|---|---|---|---|
| U1 Stepped create, More options, errors per step, Photos and video, Review, success | R1–R4, R13–R16, A1, A2, A8–A10; D1–D3 | no | no |
| U2 Readiness hints | R5, A3; D4 | no | yes |
| U3 Category-change sheet, kept answers | R6, A4; D5 | no | no |
| U4 Edit overview, drafts, leave guard, version and conflict rebase | R7–R9, A5, A6; D6–D10 | yes | yes |
| U5 Admin add and edit for a shop, reason, audit, restore | R10, R11, A7; D11, D12 | yes | yes |
| U6 Shop badge, history, home line | R12, A7; D13 | no | yes |

Every unit changes behaviour. bulk-sheet U5 depends on U4's columns and U5's admin upload routes.

## Open questions
None. Q35 and Q36 are Claude · reversible.
