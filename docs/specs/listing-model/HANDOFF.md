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

## State on 2026-11-08 (end of the first account's session)
- **Done, reviewed, committed:** channel-catalogue; field-maps (units 1–3); attributes (units 1–3); dynamic-form
  units 1 (new questions as facts, form grouped "Required now" / "Also helps on" with channel badges) and 2
  (stored completeness per channel, refresh job, product edit strip, Home line).
- **Proof on a production copy (owner's one-time permission, copy dropped):** migrations clean; compare PASS
  (113 products, 413 answers, 0 lost); Amazon map faults fixed (field-maps Q20–Q22); remaining Amazon
  refusals are answers products have not given; Google: 70 items lack Audience (product data).
- **Next, in order:**
  1. **dynamic-form unit 4 — brand form** (TRD D7, spec R7, A4, A5): three party blocks (maker, packer,
     importer: name, address, pincode → `BrandParty`, written through catalog's brand repository, Brand's one
     writer) and "Registered on Amazon / list as Generic" (`Brand.amazonRegistered`). Then retire the shop-wide
     switch: drop the `OrgListingDefaults_generic_to_brands` trigger (attributes Q16), remove the shop toggle,
     and make `platform-listing.service.ts` read the brand's flag (review note).
  2. **dynamic-form unit 3 — switch reads and writes** (TRD D4, attributes Q7, Q13): the form saves to
     `product-value.repository` (becomes ProductValue's one writer, keeps `ProductValueSet`); readiness, the
     builder (`listing-build.service`), storefront facets, the feed and the product page read `ProductValueSet`;
     a product may override country, maker, packer, importer (A4: "From your brand Noor" / "Set on this
     product" / "Use brand's"); the migration that switches writes drops every attributes sync trigger in the
     same migration. Move the fact's marketplace source and unlisted flag onto the value row first (attributes Q13).
     Also left from unit 2 (dynamic-form Q2, decided): counts on the products list's channel filter from
     `ProductChannelState`, and the strip on the product view page.
  3. **retire-old-paths** (its own spec/TRD): backup, re-run `scripts/attributes-compare.ts`, then drop
     `Product.facts`/`measurements`, ChannelAttributeMap/Fill/ValueMap, `FACT_DECLARATIONS` and old readers.
- No open questions in any `decisions.md`.
- **This machine was overloaded at the end:** run the integration suite with `--no-file-parallelism` if
  parallel runs time out; the stop hook's related-test run can clash with a full run.

## How to build (the repo's own rules)
- `/bb-build` per subfeature, unit by unit, on `feat/listing-model`; a failing test per acceptance id first;
  mutation-test every new guard and record it in the CHANGELOG; `/bb-review` in a fresh context per unit.
- Gates: `npx tsc --noEmit -p .`, `npx vitest run tests/unit`, integration against the local
  `bhendi_bazaar_ci` database, `npm run lint:boundary`, `npm run docs:check`, `npx next build`.
  Run them with Node 22+ first on PATH (`/opt/homebrew/bin`): Node 20 breaks Vitest's error reporter.
- Never migrate a non-local database; reference data ships as data migrations (CLAUDE.md invariant 7).
- Commit each unit; the owner asked (2026-11-08) that every unit be pushed and **merged into
  `feat/listing-model`**. A cloud session works on its own `ccr-…` branch and fast-forwards
  `feat/listing-model` after each reviewed unit; if `feat/listing-model` moved, ask before a real merge.
  The owner also pushes to `feat/listing-model` (e.g. `ce8e9ec7`, the HANDBAG fixture): fetch first.
  One release merges the whole branch.

## Running the gates in a Claude cloud session
The container starts with no `node_modules`, Postgres stopped and a shallow clone. Before any gate:
- `npm ci`; `git fetch --unshallow origin` (docs-integrity fails on a shallow clone).
- `service postgresql start`; as `postgres`: set password `postgres`, `CREATE DATABASE bhendi_bazaar_ci`.
  Postgres stops between turns at times: start it again when psql refuses the connection.
- A gitignored `.env` with `DATABASE_URL` and `MIGRATE_DATABASE_URL` =
  `postgresql://postgres:postgres@localhost:5432/bhendi_bazaar_ci`, plus `NEXTAUTH_SECRET`, `NEXTAUTH_URL`,
  `NEXT_PUBLIC_APP_URL`; then `npx prisma migrate deploy`.
- Integration: pass `DATABASE_URL=…` on the command line (the helper did not see `.env` otherwise) and
  `--no-file-parallelism`. Full suite on 2026-11-08: 85 files, 659 passed.
- The container cannot reach production or Amazon. Anything needing a live token is a script the owner
  runs locally with `--env-file=.env.prod` (it needs `CREDENTIAL_KEYS` and `HOME_BRAND_ORG_ID` set
  there, or the local `.env` fills them and the token fails to decrypt).

## Facts worth knowing before you start
- **Amazon's requirements live in the type schema's `allOf` rules, not its `required`.** HANDBAG's
  `required` lists six attributes, all filled by the create; the 19 the shop must answer are in rules
  whose `if` is "not a variation parent". `server/channels/providers/amazon/amazon.requirements.ts`
  judges each rule in three values for one standalone, shop-shipped new listing (channel-catalogue Q3):
  holds → required; another listing only, either/or, or cannot tell → conditional. Read a new type with
  `scripts/amazon-type-probe.ts <TYPE> --save` (owner runs it; the fixture lands in `tests/fixtures/amazon/`).
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
- **One question per real-world fact, mapped to every channel; never a question per channel** (parent
  Q5, Q6, Q26, Q27; ADR-0070). The owner asked on 2026-11-08 how a fix like Amazon's `outer` is made;
  the answer, already decided: "Outer material" (today's Material, labelled per type) maps to Amazon
  `outer` **and** `material`, Flipkart, Meesho, Google and Meta `material`; "Lining material" (a new
  Q26 attribute) maps to Amazon `inner` and `lining_description`. The form asks what connected channels
  need under "Required now" with channel badges, the rest under "Also helps on…"; nothing blocks a save
  (ADR-0053) and readiness names what each channel lacks. A field no question answers raises a
  "needs a developer" request (field-maps R1), and the new attribute then serves every channel.
- **Google and Meta (channel-catalogue Q8, owner):** gender, age group and size are sent for visibility
  though India does not enforce them, asked only through answers held (audience → gender; age group and
  size derived). Today's feed (`server/listing/shopfront-feed.ts`) sends none of colour, gender, age
  group, size or material: **field-maps must make it send them**, or Q8 changes nothing a buyer sees.
- The requests engine is decoupled (`tests/unit/requests-decoupled.test.ts`); a marketplace ticket kind
  lives in `server/requests/marketplace/`.

## Progress log (append below as units land)
| Date | Subfeature | Unit | Commit | Note |
|---|---|---|---|---|
| 2026-11-07 | all | Plan, specs, decisions, UX docs, TRDs, ADR-0070 | (this commit) | Ready to build |
| 2026-11-07 | channel-catalogue | 1, 2: tables, Amazon read, readiness, Home line; Flipkart/Meesho/Google/Meta data migration | (this commit) | Gates green. **/bb-review not yet run** (paused by owner to hand off): run it on this commit first, then field-maps unit 1 |
| 2026-11-08 | channel-catalogue | Review of units 1–2, and its fixes; Google/Meta Q8 | c11ad764 | Review found: Amazon `allOf` rules lumped as conditional (A1 unproven), suite pollution, Google/Meta asking duplicate questions, A4 missing. All fixed. **Next:** run `scripts/amazon-type-probe.ts HANDBAG --save` with production access to prove A1, then field-maps unit 1 (which must make the feed send the Q8 attributes) |
| 2026-11-08 | channel-catalogue | Fresh-context review of the fix unit, and its three fixes | e0531b99 | No invariant breach; evaluator now honours `false` subschemas, nested `if`s and only truly always-sent attributes. Next unchanged: the HANDBAG probe, then field-maps unit 1 |
| 2026-11-08 | channel-catalogue | A1 proven on Amazon's real HANDBAG schema (owner ran the probe) | 1755a800, 94e2f50d | 19 shop fields, every refusal field among them; field-maps notes added above. **Next:** field-maps unit 1 |
| 2026-11-08 | (programme) | Handoff for the next session; searchability spike started | b85fdc2a | Next: field-maps unit 1; the spike runs alongside, owner reads it before any spec |
| 2026-11-08 | (programme) | Searchability spike: findings and recommendation | 6fa71422 | Recommends field-maps first, then site markup + crawler policy, then a per-channel listing-quality score with attribute-built titles and Amazon search terms |
| 2026-11-08 | field-maps | 1: tables, builder, rules, units, Amazon shape + schema check, feed tags, create switched | (this commit) | Next: field-maps unit 2 (default maps for all five channels from their docs, translating today's maps; admin screen) |
| 2026-11-08 | field-maps | 2: default maps for all five channels (700 researched + carried over), Meesho categories, admin screen and route | (this commit) | Reviewed; fixes in. Next: unit 3 |
| 2026-11-08 | field-maps | 3: proof tooling (`scripts/field-maps-proof.ts`, feed checker), Meta leaves out uncategorised items | (this commit) | **Owner:** run `npx tsx --env-file=.env.prod scripts/field-maps-proof.ts` and record the result. Next: attributes unit 1 |
| 2026-11-08 | attributes | 1: dictionary, options, type questions, typed values + read copy kept in step by trigger (Q7–Q10) | (this commit) | Next: attributes unit 2 (brand parties, type follows category, new attributes) |
| 2026-11-08 | attributes | 2: brand parties + per-brand Generic, type follows category (trigger, tree-aware), new questions less duplicates (Q14–Q16) | (this commit) | Reviewed; fixes in |
| 2026-11-08 | attributes | 3: compare gate (`scripts/attributes-compare.ts`), local run 0 mismatches | (this commit) | **Owner:** run the compare against a production copy before release. Next: dynamic-form unit 1 |
| 2026-11-08 | field-maps, attributes | Proof run on a production copy (owner's one-time permission; copy dropped): compare PASS 0/413; Amazon map faults fixed (Q20–Q22); remaining refusals are unanswered questions | (this commit) | Next: dynamic-form unit 1 |
| 2026-11-08 | dynamic-form | 1: new questions as facts (Q5), form grouped Required now / Also helps on with channel badges (Q6) | (this commit) | Next: dynamic-form unit 2 (completeness rows, connect prompt, bulk fill) |
| 2026-11-08 | dynamic-form | 2: ProductChannelState + refresh job, product strip, Home line (Q9, Q10) | (this commit) | Next: dynamic-form unit 4 (brand form: parties, Generic, product overrides), then unit 3 (switch reads/writes, drop triggers) |
| 2026-11-08 | dynamic-form | 2: review fixes (HSN, not sold, unread types, archived, shop on row, per-shop lock, daily sweep folded into channels.maintain) | (this commit) | Next: dynamic-form unit 4 (brand form), then unit 3 (switch), then retire-old-paths — see State above |
