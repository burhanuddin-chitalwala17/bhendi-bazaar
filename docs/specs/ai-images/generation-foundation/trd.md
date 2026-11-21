# TRD — ai-images/generation-foundation

- **Status:** Accepted
- **Domain:** content (new `server/content/generation/`), worker jobs
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-21
- **References:** [spec.md](spec.md), [../decisions.md](../decisions.md), the spike (handoff, 2026-11-20), [INTEGRATIONS.md](../../../INTEGRATIONS.md#image-generation-cloudflare-ai-fal), `431ed6e7:docs/specs/image-enhancement/trd.md` (D2–D4, D10), [ADR-0037](../../../adr/0037-the-host-is-a-deployment-fact-not-an-architectural-input.md), [ADR-0038](../../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md), [ADR-0046](../../../adr/0046-a-new-model-is-checked-against-the-field-before-the-codebase.md), [ADR-0059](../../../adr/0059-an-enhancement-never-changes-the-products-pixels-proven-before-encoding.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
A new module, `server/content/generation/`, that knows nothing about enhancement, listings or social
posts. Callers hand it a **generation request** — purpose, prompt parts, reference images as bytes,
shape, size, an idempotency key — and get back image bytes, the model that made them and their cost.
Inside: an **interface** (the port), one **adapter per provider API** that alone speaks that API's
dialect, a **registry** of models as data, a **router** that turns a purpose into an ordered,
capability-filtered list of models, a **prompt composer** that keeps the platform's words and the
seller's apart, and a **ledger** row per generation. The scene tool is its first caller: today's
`ScenePainter` becomes a thin adapter over the port, so `tools/scene.ts` — and its paste-back and
pixel check — does not change.

## Prior art
- **Ports and adapters for model providers is the established shape.** LiteLLM, OpenRouter,
  Vercel's AI SDK and LangChain all put one calling convention in front of many providers, with a
  model list as configuration (LiteLLM's `model_list`, OpenRouter's model slugs). We follow the shape
  and **not the packages**: the AI SDK was considered and rejected (Q5) because it puts a vendor's
  types into server code and its image-generation surface trails the providers' own; LiteLLM is a
  Python proxy we would have to host. Two adapters on plain `fetch` is less code than either
  integration, and it matches `server/content/providers/` and `server/channels/` today.
- **Fallback on availability, never on refusal.** OpenRouter and LiteLLM retry the next provider on
  5xx, timeouts and rate limits, and not on a content-policy refusal; doing otherwise shops a
  refused prompt around until something says yes. We follow it.
- **Idempotency by a client key with a stored result** is Stripe's pattern (`Idempotency-Key`,
  result replayed on retry). Neither Cloudflare nor Gemini documents an idempotency header, so the
  key and the stored result are ours: the row is written before the call and the output object
  before the row is marked done. We follow it, with the one gap stated in D6.
- **Generation records ("predictions")** — Replicate, OpenAI and fal each return a durable object
  per run with inputs, model, status, timings and cost. Our `Generation` row is that object, kept on
  our side because neither provider reports cost (INTEGRATIONS).
- **Pattern found in our code that is wrong:** `TOOL_COST_PAISE` in
  `server/content/enhancement.types.ts` prices fal in paise at a rate typed into a comment (≈$0.04 →
  350 paise). That is the hard-coded rate Q13 forbids. Fixed here for scene (D7); the segment entries
  keep their paise constants until segmentation moves onto a priced registry, recorded as drift in
  the content domain's CLAUDE.md.

## Technical decisions
- **D1 — The port.** `generation/generator.ts` declares `GenerationRequest` (purpose, platform
  prompt and its version, optional seller brief, references as `{ bytes, mimeType }[]` with the
  subject first, aspect, size, idempotency key, and who asked) and `GenerationResult` (bytes, model id,
  cost in paise and in micro-dollars, the rate used). No vendor field name appears in either. One
  image per request: `count` is left out until a caller needs more (YAGNI); the result is an array
  so adding it changes no signature.
- **D2 — One adapter per provider API.** `generation/adapters/cloudflare.ts`, `gemini.ts` and
  `fal.ts`, each exporting `{ key, isConfigured(), call(model, request) }`. Each maps our aspect and
  size to its own, sends references in its own form (Cloudflare third-party: data URLs in
  `image_input[]`; Cloudflare hosted `@cf/`: a multipart body; Gemini Interactions: base64
  `{type:"image"}` inputs; fal: a data URL), reads the picture back (a URL fetched once more, or
  base64), and **classifies every failure** into `UNAVAILABLE` (network, timeout, 5xx, 429),
  `NO_CREDIT` (402 or billing text), `REFUSED` (the provider's safety block) or `BAD_OUTPUT`
  (nothing readable came back), plus `UNCERTAIN` (a timeout after sending, or a made picture we could
  not fetch: possibly billed, so never passed on, and the model's price is recorded as spent). Only
  `generation/adapters/` may name a provider's **host or credential** — the registry holds each
  provider's model path as data — and `tests/unit/generation-vendor-boundary.test.ts` scans for both.
- **D3 — Models are data.** `generation/registry.ts` is a typed table, one entry per model route:
  id (ours, stable, e.g. `cf/flux-2-klein-4b`, `gemini/nano-banana-pro`), adapter key, the
  provider's model path, `maxReferences`, the aspects and sizes it makes, and a **price rule**
  (`perImage`, `perOutputTile`, `perMegapixel` with input terms) in micro-dollars, each entry
  carrying the date and source it was checked against. The same model through two providers is two
  entries. In code rather than a table: changing it is a reviewed deploy, the set is small, and
  prices need their source beside them (Q12 parks an admin screen).
- **D4 — The router.** `generation/router.ts`: for a purpose, the ordered list comes from the first
  **model-order source** that has one (`generation/model-order.ts`; today only the environment's
  `IMAGE_GEN_MODELS_<PURPOSE>`, comma-separated ids), else the default list in code. Sources are async
  so the admin screen parked in Q12 plugs in as one source reading a table, placed first, with no
  change to the router or its callers; unknown ids are
  skipped with a log line, never a crash. It drops entries whose adapter is not configured, whose
  `maxReferences` is below the request's count, or which cannot make the aspect, then tries each in
  order. `UNAVAILABLE` and `NO_CREDIT` move to the next; `REFUSED`, `BAD_OUTPUT` and `UNCERTAIN` end
  the run (spec R5). `quote()` and `maxReferencesFor()` give the first eligible model's price and
  reference limit; their caller is improve-with-ai's request path (the scene needs neither: its price
  is settled from the ledger).
- **D5 — Settings named for what they hold (ADR-0037).** `IMAGE_GEN_CLOUDFLARE_ACCOUNT_ID` and
  `IMAGE_GEN_CLOUDFLARE_API_TOKEN` (the multi-model gateway account — Cloudflare today), `IMAGE_GEN_GEMINI_API_KEY`
  (a key to one maker's own API cannot be named without the maker; the name is the API it opens, not
  the integration that provisioned it, which is what rule 4 forbids), and today's `IMAGE_MODEL_API_KEY`
  / `IMAGE_MODEL_ENDPOINT` for fal, unchanged. Read only in `generation/adapters/*`.
- **D6 — A `Generation` row per call, written before the call.** Columns: id, purpose, idempotency
  key (unique), model id, state (`SUBMITTED`, `SUCCEEDED`, `FAILED`, `REFUSED`), prompt version,
  platform prompt, brief, reference asset ids, aspect, size, cost (micro-dollars and paise), rate day,
  output object keys, synthetic, contains-person, error, timestamps, and the enhancement it served.
  **The spend is recorded the moment a model answers** (or may have: `UNCERTAIN`), before the picture
  is converted or stored, and added rather than set. A storage error after that escapes unwrapped for
  the queue to retry. On a retry with the same key: `SUCCEEDED` returns the stored objects with no
  call; `REFUSED` returns a refusal and `FAILED` an unavailable failure, with no call; `SUBMITTED`
  younger than twice the call timeout may still be in flight on another worker, so the retry waits for
  the queue; older, the worker died mid-call — **we cannot know whether the provider billed** — so the
  call is made again, the row records `retriedAfterUnknown`, and both spends are on it. Written only by
  `server/content/generation.repository.ts` (Invariant 5).
- **D7 — Cost is integer arithmetic from a daily rate.** `ExchangeRate` (day, paise per USD as an
  integer, source, fetched at). Cost in paise = ceil(micro-dollars × paise-per-USD / 1,000,000), in
  integers (Invariant 3). The ECB USD→INR reference rate is fetched from Frankfurter (keyless) **the
  first time a priced picture is asked for on a UTC day** (`generation/exchange-rate.ts`), not by a
  schedule: the worker's four schedule slots are full (`JOBS_MAX_SCHEDULES`), each slot is an idle
  query budgeted in `jobs.config.ts`, and a day with no paid picture needs no rate. A failed fetch
  uses the latest stored day, which the row records; with no row at all, a priced model is refused
  before it is called (Q13). Scene's `SCENE_PAINT_PAISE` is replaced by the quote; `costPaise` on the enhancement row is
  the cut-out constant plus the generation's actual cost, settled when the run proposes.
- **D8 — The scene moves (Q11).** `providers/scene/generated.ts` implements `ScenePainter` over the
  router with purpose `scene` (default list `cf/flux-2-klein-4b`, `fal/bria-product-shot`), sending
  the cut-out as the one reference and the preset's prompt wrapped in `prompts/scene.v1`. The
  enhancement row's `provider` records `generation` (a new `ENHANCEMENT_PROVIDER` value; the column is
  a string) and the `Generation` row names the model. `providers/scene/model.ts` becomes the fal
  adapter's Bria entry and is deleted. `tools/scene.ts` and `pixel-identity.ts` are untouched.
- **D9 — Prompts are versioned.** `generation/prompts.ts` exports each purpose's platform text with
  its version string (`scene.v1`); a change adds a version, never edits one; a seller's brief, when there is one, is appended inside a marked section the platform text
  tells the model to treat as a description, never as instructions. The version string is stored on
  the row. Product facts (colour, material) join in improve-with-ai.
- **D10 — The comparison is a script (spec R9).** `scripts/generation-bakeoff.ts`
  (`npm run generate:bakeoff -- --org <id> --models a,b,c [--limit 20] [--purpose scene]`) generalises
  `scripts/segment-bakeoff.ts`: each photograph through each named model, outputs and an `index.html`
  under `bakeoff/<runId>/` via the loose-object seam, cost and milliseconds under each; no
  `Generation` or `Enhancement` row is written.
- **D11 — Absorbed free-tool spend (Q16, Q38).** A query, never a counter (ADR-0058): this month's
  runs of the four tools that cut out first, less those the paid model cut, beyond the declared free
  allowance, times the declared overage ($0.50 per 1,000, unverified against a bill) at the day's
  rate. A scene row names its painter, not its cutter, so every scene counts as the host's — an
  overcount of absorbed spend, never an undercount. Shown on `/admin/enhancements` beside the spend.
- **D12 — One contract test for every adapter.** `tests/unit/generation-adapter-contract.test.ts`
  runs each adapter against recorded replies (success, timeout, 5xx, 402, refusal, garbage) with
  `fetch` stubbed, asserting the same classified outcomes. A new adapter joins the table.

## Packages
None.

## UI approach
None — one figure added to `/admin/enhancements` through its existing components (D11).

## Gates touched
- One repository per aggregate: two new repositories (`generation.repository.ts`,
  `exchange-rate.repository.ts`); `tests/unit/one-repository.test.ts`.
- A new source-scanning gate, `generation-vendor-boundary.test.ts`, mutation-tested (ADR-0056).
- No new schedule (D7): the rate is fetched on first use, so `JOBS_MAX_SCHEDULES` and the idle budget are unchanged.
- `content/CLAUDE.md` (if present) or the domain's ARCHITECTURE notes gain the module; docs-integrity.

## Data model
[MIGRATION] `Generation`, `GenerationState` enum, `ExchangeRate`. No existing column changes;
`Enhancement.provider` gains the value `generation` (string). No money column is a float.

## API / contract changes
None. `EnhancementDto` is unchanged; CONTRACTS.md checked — no cross-domain shape moves.

## Test plan
- `generation-router.test.ts` — ordering, the setting, capability filter, fallback on unavailable and
  no-credit, stop on refusal and bad output, unknown ids skipped.
- `generation-adapter-contract.test.ts` — D12.
- `generation-cost.test.ts` — every price rule, ceil in integers, rate fallback to latest, refusal
  with no rate.
- `generation-idempotency.test.ts` — replay without a call; `SUBMITTED` re-call flagged.
- `generation-vendor-boundary.test.ts` — mutation-tested: a host string added outside `adapters/` fails.
- `enhancement-scene.test.ts` unchanged and green; `enhancement-scene-painter.test.ts` rewritten for
  the generated painter.
- `generation-cost.test.ts` also holds the rate's parse; `enhancement-service.test.ts` the absorbed figure.

## Delivery (PRs)
Landed as one commit on the working branch (2026-11-21), the review's fixes as a second; the split
below is how it reads.
1. Port, registry, router, cost, prompts, `Generation` + `ExchangeRate` schema and repositories, the
   fx job; adapters for Cloudflare, Gemini and fal with the contract test. No behaviour change.
2. Scene moves onto the port (behaviour change: klein-4b paints, cost from the quote).
3. The comparison script and the absorbed-spend figure.

## Open questions
None. The Cloudflare `@cf/` multipart field names are read from one live call before PR 1 merges
(INTEGRATIONS: not documented); that is verification, not a decision.
