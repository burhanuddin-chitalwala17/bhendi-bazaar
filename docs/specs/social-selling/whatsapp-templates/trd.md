# TRD — social-selling/whatsapp-templates

- **Status:** Draft
- **Domain:** campaigns (new), channels (WhatsApp plug)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [spec.md](spec.md), [ux.md](ux.md) (Draft), [decisions.md](decisions.md), parent [decisions](../decisions.md) Q7, Q79, Q80, Q81, [connect-whatsapp](../connect-whatsapp/), [INTEGRATIONS.md](../../../INTEGRATIONS.md#acting-for-a-shop-on-meta-catalogue-whatsapp-instagram), [ADR-0004](../../../adr/0004-money-as-integer-paise.md), [ADR-0038](../../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md), [ADR-0054](../../../adr/0054-a-channel-mapping-carries-a-checked-date-and-source-and-required-ness-is-data.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
Templates are a `campaigns` concept with a WhatsApp shape. `server/campaigns/` owns the
`MessageTemplate` aggregate: what the shop wrote, its language, category, state and Meta's id.
It declares a `TemplatePublisher` port (submit, delete, read status); `channels` implements it for
WhatsApp with the shop's token, which never leaves `channels` (parent Q7). Meta's template-status
webhook arrives at `channels`' signed WhatsApp webhook (parent Q80) and reaches campaigns as a
neutral `campaigns.template-status` job, which channels' `whatsapp.template-status` handler
(connect-whatsapp D7) enqueues; that mapping is built here. The starter set is declared in code.

## Prior art
- **Meta's Template Management API** (`POST /<WABA_ID>/message_templates`, status webhook
  `message_template_status_update`, quality webhook `message_template_quality_update`). Meta
  documents name+language as unique per account; we key on it, so a retried submit answers
  "already exists" and is treated as success (D3).
- **Interakt, AiSensy, Wati** (Indian WhatsApp tools) all offer a starter library copied into the
  shop's account and show Meta's state per template; we follow them. They let shops edit starter
  templates in place; we do not (Q4), so a fix to ours reaches every shop.
- **Prices as dated data**: our own channel mappings (ADR-0054) carry a source and checked date;
  the rate table follows the same rule. Meta publishes no price API.

## Technical decisions
- **D1 — Domain `server/campaigns/`.** Public surface `template.service`, `template.types`;
  `template.repository` the one writer of `MessageTemplate`. No import of `channels` providers
  (boundary test, parent Q7); `channels` registers its `TemplatePublisher` at start-up through
  `server/shared/` wiring, the same way job handlers register.
- **D2 — `MessageTemplate`**: shop, origin (`STARTER` with its starter key, or `OWN`), name, language
  (`en`, `hi`), category asked and category Meta gave, components as parsed JSON (header, body,
  footer, buttons; Zod schema in `src/lib/validation/schemas/`), state (closed set `TEMPLATE_STATE`:
  `DRAFT`, `IN_REVIEW`, `APPROVED`, `REJECTED`, `PAUSED`, `DISABLED`), Meta's id, reason code and
  sentence (≤300 chars), paused-until, created-by, archived-at/by.
- **D3 — Submission is a job**, `campaigns.template-submit`, one per template, keyed on the
  template id. A step added to channels' `whatsapp.connected` handler (connect-whatsapp D4)
  enqueues `campaigns.starter-set` for the shop,
  which writes the missing starter rows and their submit jobs in one transaction (Q2). A 409 or
  "name exists" from Meta reads the existing template's state instead of failing.
- **D4 — Placeholders are a closed set** (`TEMPLATE_VARIABLE`: first name, shop name, product
  name, product price, product link) mapped to Meta's positional `{{1}}`. A missing first name is
  filled with a per-language fallback ("there" / "नमस्ते") so a send never fails on it (hazard 4).
  Product price is read from the effective-price resolver at send (Invariant 1), never stored.
- **D5 — STOP line** appended to every marketing body in its language; a body that already ends
  with one is not doubled.
- **D6 — Status sync**: the webhook job updates state, category and reason; a daily
  `campaigns.template-look` (one slot, one Meta read per connected account, batched across shops
  like listing-problems) catches any missed webhook (hazard 1).
- **D7 — Rates**: one rates module in campaigns holds India rates per category in paise
  (marketing 86 paise, rounded from ₹0.8631; utility 12 paise, rounded from about ₹0.115) with
  source and checked date. A re-categorised template shows Meta's category's rate (hazard 3, Q6).
  Rounding up to the paisa is documented beside the table (ADR-0004 D2).
- **D8 — Held campaigns**: campaigns reads the template's state at send; anything but `APPROVED`
  holds the campaign (whatsapp-campaigns D6).

## Packages
None.

## UI approach
Rules: [src/components/CLAUDE.md](../../../../src/components/CLAUDE.md); screens, states, copy:
[ux.md](ux.md).
- **Per form factor:** phone: one list, a filter row (All, Approved, Needs you), each row a card;
  the editor is a full page with a live phone-bubble preview below the form. `md:` puts the
  preview beside the form; `lg:` keeps two columns with the list at a fixed width.
- **Rendering:** `/org/[orgId]/whatsapp/templates` page reads `templates.dal.ts` on the server;
  client leaves are `TemplateEditor` (`useServerForm` on the shared schema), `TemplatePreview`,
  `ArchiveTemplateDialog`.
- **Behaviour:** `templatesApiClient` (create, copy, archive) in `src/components/campaigns/`;
  `useMutation` for copy and archive. Props are `TemplateDTO` from `template.types`.
- **Surfaces:** `StatusBadge` for state, `FormDialog` for archive (sheet on phone), media picker
  from the media library for an image header. No new token.

## Gates touched
- `module-boundaries` — `campaigns` in `PUBLIC_SURFACE`; campaigns never imports `channels/providers`.
- `docs-integrity` — the new domain's CLAUDE.md in `LIVING_DOCS`; root CLAUDE.md domain table.
- `portal-boundary` — `/api/org/[orgId]/whatsapp/templates/**` use `withOrg`.
- `request-body-parsing` — the template schema; `one-repository` — `MessageTemplate`.
- Rate-limit registry — the org routes classified.

## Data model [MIGRATION]
`MessageTemplate` as D2; unique (shop, name, language). Never cascades from a shop (ADR-0020).

## API / contract changes [CONTRACT]
`TemplateDTO`, `TEMPLATE_STATE`, `TEMPLATE_VARIABLE`; routes list, create, copy, archive.
CONTRACTS.md gains "WhatsApp templates".

## Test plan
- Unit: component schema (buttons ≤2, variables only from the set, STOP appended once); every
  `TEMPLATE_STATE` maps to ux.md's copy; rate lookup by Meta's category; missing first name filled.
- Integration: starter-set job twice leaves twelve rows and twelve submits; a "name exists" answer
  reads state; status webhook job moves state; daily look corrects a missed pause; a paused template
  holds a campaign. Meta stubbed at `fetch`.
- Manual: owner's test WABA, twelve starter templates approved (A1), at 360px.

## Delivery (units)
1. Domain, schema, repository, rate table, starter declarations — no behaviour.
2. `TemplatePublisher` in channels; starter-set and submit jobs on connect — behaviour-changing. Not merged until a native reader has read the Hindi (Q3).
3. Status webhook job and daily look.
4. Templates page, editor, preview, archive.

## Open questions
None. Q3 decided by the owner 2026-11-06.
