# TRD — ai-images/improve-with-ai

- **Status:** Accepted
- **Domain:** content, reading catalog (media) and payouts (credit); channels for the main-image rule
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-21
- **References:** [spec.md](spec.md), [ux.md](ux.md) (signed off, Q31), [../decisions.md](../decisions.md) (Q1, Q3, Q10, Q24–Q28, Q32, Q33), [generation-foundation](../generation-foundation/), [media-tags](../media-tags/), [shop-credits](../shop-credits/), [ADR-0076](../../../adr/0076-image-generation-goes-through-one-port-and-models-are-data.md), [ADR-0059](../../../adr/0059-an-enhancement-never-changes-the-products-pixels-proven-before-encoding.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
A seventh enhancement tool, `STYLED`, on the existing ledger, so the lock, the pause, the monthly
allowance, the daily cap, the worker and accept-as-derived-image all apply unchanged. Its request
carries a brief, reference pictures and a face choice; it is charged from the shop's credit in the
request's transaction; the worker generates through the generation port with purpose `listing`, and
keeps every result straight into the library (Q25). The client is one split button and one dialog
reused in the library and the product form.

## Prior art
None — no new persistence shape, data model or integration pattern: a tool on the existing ledger
(image-enhancement D1), a call to the existing port (ADR-0076), and a charge on the existing credit
ledger (shop-credits D5). The one rule with a field precedent is R11: Amazon's July 2026 image policy
keeps AI-made pictures of people to secondary slots (INTEGRATIONS, marketplaces); we apply it to every
AI-made picture on every marketplace.

## Technical decisions
- **D1 — `STYLED` is an enhancement tool, not one of the six.** Added to the `EnhancementTool` enum and
  its mirror; `AVAILABLE_TOOLS` stays the six exact tools the ▾ menu lists, so nothing in the menu or
  the cost table changes. The face choice is the row's `preset` (`no-face` | `with-face`), the brief
  and the reference URLs are new `Enhancement` columns, and `previousId` names the run a Regenerate
  came from (R9).
- **D2 — ADR-0077 limits ADR-0059 to the backdrop tools** (Q28): white, studio and scene keep the pixel
  promise; `STYLED` promises verified-by-the-seller, labelled, and never a marketplace's main image.
- **D3 — Request (R3–R6, R12).** `POST /api/org/[orgId]/enhancements/styled` parses
  `requestStyledSchema`: the photo (asset id or URL), `brief` 1–300 characters, `referenceRefs` (URLs),
  `face`, `previousId`, slot and role. The service checks the lock, pause, allowance and cap as today;
  resolves the photo and every reference to the shop's own ready images; asks the router for a quote
  with 1 + references (`quote`, generation-foundation D4) and refuses more references than the first
  model takes; then, in one transaction, writes the row, `creditService.charge` (cost of the first
  model, refused below the worst eligible), and enqueues `image.enhance`. References are tagged
  Reference (`addTag`, media-tags D3).
- **D4 — Quote.** `GET /api/org/[orgId]/enhancements/styled/quote?references=n` answers the charge with
  margin, the balance and the reference limit, so the modal's cost line and "up to N" are the server's
  numbers (R4, R6, A4).
- **D5 — Prompt `listing.v1`.** Platform rules (the product in the first reference is shown unchanged:
  colours, pattern, embroidery, text, logos; photorealistic; no added text or watermark), the face
  rule (`no-face`: worn and framed below the chin or turned away, never headless; `with-face`:
  natural, modest), then the brief inside its marked section (`withBrief`). Product facts join in a
  later version.
- **D6 — Run.** The worker reads the photo and references through `mediaAssetService`, calls
  `generate` (purpose `listing`, idempotency key `enhancement:<id>:styled`, `containsPerson` true
  unless the brief and face say otherwise is not inferred: recorded true for every listing picture),
  encodes WebP, stores the proposal and **accepts it in the same run** (Q25): the derived image's
  transform carries `tool: STYLED` and the `aiMade` mark. Then `creditService.settle(id, actual)`; a
  `DomainError` fails the row and `creditService.refund(id)` (Q20). A redelivered run finishes what the
  last began (keep, settle; or refund a failed one). Any other error is retried (`retry` 5, backoff)
  until the run is 20 minutes old, then failed and refunded; a run whose job was lost altogether is
  closed when the shop next asks for a picture. No hold stays open. (Revised after review, 2026-11-21.) A model refusal reads "This description could not be made
  into a picture. Try describing it differently — nothing was charged."
- **D7 — R11 at the one place marketplace photos are built** (`server/channels/listing-photos-out.ts`):
  an AI-made photo is never first. AI-made means its transform names `STYLED` **or carries the `aiMade`
  mark, which catalog copies onto every derivative** (`inheritAiMark` in `registerDerivedBytes` and
  `beginUpload`), so a crop or an enlargement of an AI picture stays one; the first real photograph is
  moved to the front, and a listing with only AI-made photos is refused with the reason. The product's
  own gallery is untouched.
- **D8 — Client.** `ImproveSplitButton` (content composites) — main half opens `StyledShotDialog`
  (`TaskDialog`, full screen on a phone, Q32), the arrow opens a `ResponsivePicker` of the six tools
  that hands the choice to today's `ImproveDialog` (`preselect`). `useStyledShot` holds the form, the
  run and the versions; `styledShotApiClient` makes the calls; the reference picker reuses
  `MediaLibraryPicker` and the library uploader's `uploadBatch`. Words in `styled-shot-copy.ts`.

## Packages
None.

## UI approach
Per [ux.md](ux.md). Phone first: the dialog is full screen, the description box keeps the 16px input
base, the references are a horizontal strip with a 64px "+ Add picture" tile, Generate sits in the
dialog's foot. From `md:` the dialog centres at the canvas width. Rendering: the library and product
form are already client leaves; nothing new on the server render path.

## Gates touched
- `feature-registry`: the styled request and quote are `ENH` (paid).
- `route-reachability`: callers in `styledShotApiClient.ts`.
- `overlay-surfaces`: `TaskDialog` and `ResponsivePicker` only.
- `hardcoded-copy`, `ui-primitives`, `double-submit`, `design-tokens`.

## Data model
[MIGRATION] `EnhancementTool` gains `STYLED`; `Enhancement` gains `brief`, `referenceRefs`, `previousId`.

## API / contract changes
Two new routes (D3, D4); `EnhancementDto` gains `brief`, `referenceRefs`, `previousId`. CONTRACTS.md updated.

## Test plan
- `styled-shot.test.ts` — schema; request refused over the reference limit, on a locked or paused shop,
  without credit; charge in the transaction; run accepts, settles, refunds on failure; prompt carries
  the face rule and the brief in its section.
- `listing-photos-out` — AI-made never first; all-AI refused.

## Delivery (PRs)
One unit: schema, service, routes, worker path, channel rule, ADR-0077, client.

## Open questions
None.
