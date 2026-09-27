# TRD — image-enhancement

- **Status:** Draft — 2026-09-27
- **Domain:** content (enhancement), reading catalog (assets); worker jobs
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-09-27
- **References:** [spec.md](spec.md), the image-provider brainstorm of 2026-09-25 (recorded in the journey memory and summarised in D3), [media-library trd](../media-library/trd.md) (D1, D6a, D11), [worker-foundation trd](../worker-foundation/trd.md), [ADR-0038](../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md), [ADR-0033](../../adr/0033-a-domain-is-reached-through-its-public-surface.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach

An enhancement is a row and a job: the request is recorded in the transaction that enqueues it, the worker runs one tool through one provider, writes the proposal to the object store under a proposals prefix, and marks the row proposed. Accepting copies the proposal to its final key and registers it as a derived asset of the source through the media-library seam; discarding deletes the object. Providers sit behind one interface per capability so the choice is configuration and a bake-off, never a rewrite.

## Technical decisions

- **D1 — `Enhancement` is the ledger; the proposal is an object, not an asset.** Columns: org, requester, source asset, tool, preset, provider, state (`REQUESTED`, `RUNNING`, `PROPOSED`, `ACCEPTED`, `DISCARDED`, `FAILED`), proposal object key, result asset id, cost in paise, error, timestamps. The proposal lives at `proposals/<enhancement id>` until accepted, so the library never shows what nobody chose (spec R3), and a discard is one object delete.
- **D2 — Tools are a closed set, each its own pipeline.** `cutout`: provider segmentation → PNG with alpha. `white`: cutout → composited on `#FFFFFF`, padded square, with sharp. `studio`: cutout → colour or gradient plus a soft shadow, with sharp. `scene`: cutout → provider scene generation from the preset's prompt → the cutout pasted back at its placement → sharp. `light`: sharp only — normalise, gamma, unsharp mask — no provider. `enlarge`: provider super-resolution to the smallest factor that clears the minimum. One tool per run; chaining is the member running a tool on a result (spec R1).
- **D3 — One interface per capability, two providers each, chosen by configuration.** `segment`: Cloudflare Images' `segment=foreground` on the images zone (the production images host already sits on Cloudflare DNS; free to 5,000 a month) and BiRefNet on fal (about $0.002 an image, no minimum). `scene`: Bria product-shot on fal (about $0.04; licensed data, no-training warranty). `upscale`: Real-ESRGAN on fal. Providers are reached with `fetch`, no SDK, so nothing outside the provider module knows a vendor. Photoroom is out of scope for its monthly floor.
- **D4 — Pixel identity is a test, not a hope.** For `scene`, the cutout's opaque pixels are compared to the same region of the result after paste-back with zero tolerance; the pipeline fails the run rather than proposing a product that changed (spec R4). The same test guards `white` and `studio`.
- **D5 — Quotas are a policy row and a query.** `OrgEnhancementPolicy` (org, monthly allowance, `pausedAt`, pause reason); use is `count` of accepted-or-proposed rows this month, never a counter ([media-library D7](../media-library/trd.md)). The enqueue refuses when the org is paused, at its allowance, or when today's recorded platform cost has reached `ENHANCEMENT_DAILY_CAP_PAISE`, declared once. Refusals are `DomainError`s the form shows.
- **D6 — Cost is recorded per run from a declared price table**, provider × tool, in paise, at the moment the provider is called; the admin view sums it per org per month (spec R9).
- **D7 — The time-of-use gate is a seam declared here and filled by listing-schema.** `imageMeetsChannel(asset, rule)` returns what is missing and the tool that fixes it; channel-files and instagram-publish call it, the store never does (spec R6).
- **D8 — The label slot is refused at the enqueue**, since the request names the slot it came from; the editor also hides the tools there (spec R5).
- **D9 — Runs are worker jobs on the existing queue**, grouped by org for fairness (worker-foundation D3), with the provider call inside the handler and a per-run timeout; a failed run parks with its reason and is re-runnable from admin (worker-foundation R3).
- **D10 — The bake-off is a script**, run by the owner: N asset ids through each provider of a capability, outputs written to a proposals folder and an HTML sheet, nothing recorded as an enhancement (spec R8, A6).

## Packages

None new in the application: `sharp` already exists; providers are plain `fetch`. Provider credentials are environment variables named for what they hold ([ADR-0037](../../adr/0037-the-host-is-a-deployment-fact-not-an-architectural-input.md)).

## UI approach

Phone first. A slot's menu gains "Improve…", opening a sheet listing the tools with one line each and, for scene, the preset list as tiles; the label slot has no menu entry. While a run is queued the slot shows "improving…" over the photo. The result opens a compare sheet: a before/after toggle with a swipe on a phone, Accept and Discard docked at the bottom. The library offers the same menu on a photo. Quota and pause states are one line in the sheet, never a modal. Admin gains a page listing orgs with this month's use and spend, an allowance field and a pause switch with a reason. Every control through the primitives ([ADR-0031](../../adr/0031-one-components-home-organised-by-domain.md)).

## Data model

[MIGRATION] New `Enhancement` and `OrgEnhancementPolicy`; `MediaAsset.transform` carries `{ tool, preset, provider, enhancementId }` on a result. Additive.

## API / contract changes

[CONTRACT] `EnhancementDto` for the portal; `POST /api/org/:orgId/enhancements` (tool, preset, source asset, slot), `POST …/:id/accept`, `POST …/:id/discard`; admin policy routes. [CONTRACTS.md](../../CONTRACTS.md) moves in lockstep.

## Test plan

Per [TESTING.md](../../TESTING.md): unit — tool pipelines on fixture images with provider stubs (white is 255,255,255 outside the mask; light is deterministic; pixel identity fails a changed product), quota and pause refusals, cost table lookups, the enqueue in the request's transaction; integration — accept registers a derived asset and discard leaves nothing; worker — a stubbed provider round trip through the queue; a mutation test that removing the identity check goes red.

## Delivery (PRs)

1. Tables, ledger, quotas and pause, the job, the `light` tool (no provider), the compare-and-accept sheet. Behaviour change: a dark photo can be fixed.
2. The `segment` seam with both providers, `cutout`, `white`, `studio`, and the bake-off script. Behaviour change: marketplace main images.
3. `enlarge`, and the time-of-use seam with the store-never-blocks rule.
4. `scene` with presets and the pixel-identity test. Behaviour change: Instagram-grade images.
5. Admin: use and spend per org, allowance, pause.

## Open questions

- The monthly allowance and the daily cap as numbers — proposed 200 enhancements per org and ₹500 a day platform-wide.
- A fal account and key from the owner before PR 2; Cloudflare Images transformations switched on for the images zone.
