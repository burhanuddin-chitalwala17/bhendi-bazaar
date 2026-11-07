# Handoff — listing-model

- **Verified:** 2026-11-08
- **Branch:** `feat/listing-model` (from `main` at `cdf20515`); one release at the end (decisions Q31)

> For whoever continues this programme, human or agent. Read this, then the documents it lists, in
> order. Everything decided is in `decisions.md` files; nothing here overrides them.

## Read first, in this order
1. [spec.md](spec.md) and [decisions.md](decisions.md) Q1–Q34: the model and every owner decision.
2. [trd.md](trd.md): the architecture (storage, builder, completeness, migration); and
   [ADR-0070](../../adr/0070-a-products-attributes-are-rows-mapped-to-each-channels-own-catalogue.md).
3. Each subfeature's spec, decisions and trd, in delivery order:
   [channel-catalogue](channel-catalogue/) → [field-maps](field-maps/) → [attributes](attributes/) →
   [dynamic-form](dynamic-form/) → [retire-old-paths](retire-old-paths/).
4. [plan.html](plan.html): the audit of 2026-11-06 and flow diagrams (open in a browser).

## State on 2026-11-07
- Specs accepted, UX docs signed off (no prototypes, Q34), TRDs accepted. Nothing implemented yet.
- No open questions. A new question goes in the right `decisions.md` first: owner decides product,
  policy and money; reversible technical calls are yours, marked `Claude · reversible`.

## How to build (the repo's own rules)
- `/bb-build` per subfeature, unit by unit, on `feat/listing-model`; a failing test per acceptance id first;
  mutation-test every new guard and record it in the CHANGELOG; `/bb-review` in a fresh context per unit.
- Gates: `npx tsc --noEmit -p .`, `npx vitest run tests/unit`, integration against the local
  `bhendi_bazaar_ci` database, `npm run lint:boundary`, `npm run docs:check`, `npx next build`.
  Run them with Node 22+ first on PATH (`/opt/homebrew/bin`): Node 20 breaks Vitest's error reporter.
- Never migrate a non-local database; reference data ships as data migrations (CLAUDE.md invariant 7).
- Commit each unit on the branch; push only when the owner asks. One release merges the whole branch.

## Facts worth knowing before you start
- Amazon's per-type required fields are hidden in its template's conditional formatting, not in
  `listing-node-templates/extracted/amazon.json` (whose `req` is null). They were decoded on 2026-11-06:
  HANDBAG reproduces the 13 fields of the real refusal. Recreate from the workbook (named formulas
  `reqPTListN…`, `req_tog…`, product-type lists `PTListN`) or read the Product Type Definitions API.
- Today a create never sends `Product.weight` or `measurements`; brand and shop defaults fill no fact;
  all 125 Amazon attribute maps are `required=false`. These are what the programme fixes.
- `HOME_BRAND_ORG_ID` (Niqab Boutique) is the connection that reads Amazon's definitions.
- Default field maps are researched from each channel's own documentation and recorded with source,
  date and reason (Q23); prove them with Amazon check-only and the Google and Meta validators.
- Amazon HANDBAG's real schema is `tests/fixtures/amazon/HANDBAG.schema.json` (2026-11-08). For field-maps:
  `strap_type` is mapped to the wrong question; `model_name` and `part_number` want defaults (the SKU),
  `item_type_name` a fixed value per type. Our Material must reach `outer` (required on every non-parent
  bag, `allOf[7]`) as well as `material` (required only for a material-theme variation child, `allOf[9]`);
  `inner` (required) needs a lining question we do not ask; pair values per attribute, their lists differ.
- The requests engine is decoupled (`tests/unit/requests-decoupled.test.ts`); a marketplace ticket kind
  lives in `server/requests/marketplace/`.

## Progress log (append below as units land)
| Date | Subfeature | Unit | Commit | Note |
|---|---|---|---|---|
| 2026-11-07 | all | Plan, specs, decisions, UX docs, TRDs, ADR-0070 | (this commit) | Ready to build |
| 2026-11-07 | channel-catalogue | 1, 2: tables, Amazon read, readiness, Home line; Flipkart/Meesho/Google/Meta data migration | (this commit) | Gates green. **/bb-review not yet run** (paused by owner to hand off): run it on this commit first, then field-maps unit 1 |
| 2026-11-08 | channel-catalogue | Review of units 1–2, and its fixes; Google/Meta Q8 | c11ad764 | Review found: Amazon `allOf` rules lumped as conditional (A1 unproven), suite pollution, Google/Meta asking duplicate questions, A4 missing. All fixed. **Next:** run `scripts/amazon-type-probe.ts HANDBAG --save` with production access to prove A1, then field-maps unit 1 (which must make the feed send the Q8 attributes) |
| 2026-11-08 | channel-catalogue | Fresh-context review of the fix unit, and its three fixes | e0531b99 | No invariant breach; evaluator now honours `false` subschemas, nested `if`s and only truly always-sent attributes. Next unchanged: the HANDBAG probe, then field-maps unit 1 |
| 2026-11-08 | channel-catalogue | A1 proven on Amazon's real HANDBAG schema (owner ran the probe) | (this commit) | 19 shop fields, every refusal field among them; field-maps notes added above. **Next:** field-maps unit 1 |
