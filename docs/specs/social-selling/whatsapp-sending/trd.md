# TRD — social-selling/whatsapp-sending

- **Status:** Accepted
- **Domain:** campaigns (new)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-23
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](ux.md), the architecture [TRD](../trd.md) (A-D8, D9, D13), [consent-core TRD](../consent-core/trd.md), [ADR-0004](../../../adr/0004-money-as-integer-paise.md), [ADR-0069](../../../adr/0069-notifications-are-one-hub-every-module-plugs-into.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
One door for every business-initiated WhatsApp message: `deliverByWhatsApp` checks consent, the
how-often rule and the spending limit inside one transaction, writes the send row, and answers
sent, skipped or held. Templates are this domain's rows mirrored from Meta; spend is reserved before
a send and settled from Meta's pricing in the status webhook.

## Prior art
- **Pre-authorisation and capture** (card payments): reserve an amount against a limit, settle the
  actual. Followed for spend (A-D13).
- **Frequency capping** in marketing platforms (Braze, MoEngage): per user per window, counted
  across channels. Followed, with a lock per buyer so it is exact.

## Technical decisions
- **D1 — The port (R1, Q12).** `deliverByWhatsApp({ orgId, contactId, template, values, purpose
  MARKETING|UTILITY, sourceRef, idempotencyKey })`. In one transaction: `may` (consent-core); for
  MARKETING the how-often check under `pg_advisory_xact_lock(org, contact)` counting
  `MarketingTouch` for the IST day and week against the shop's rule (Q40 default 1/4); spend
  reservation (A-D13) at the template's price; insert `WhatsAppSend` (QUEUED, unique
  idempotencyKey) and `MarketingTouch`; enqueue the send. Answers `SENT_QUEUED`, `SKIPPED(reason)`
  or `HELD(LIMIT)` (a held send keeps its row `HELD` for Send held). No other module calls the
  WhatsApp source for a template: the module-boundaries test allows `WhatsAppPort.sendTemplate`
  only from this domain.
- **D2 — Sending (A-D8, A-D9).** `campaigns.wa-send` claims rows on the connection's `messages`
  lane, sends with `biz_opaque_callback_data` = row id; statuses settle `DELIVERED`, `READ`, `FAILED`
  (Meta's code mapped: not on WhatsApp, blocked, limit), and `pricing` settles spend: the
  reservation is released and the actual added in one update.
- **D3 — Rates (Q10).** `campaigns/rates.ts`: India per-category paise rates with source and checked
  date; estimate = rate × count; the review shows "about". A rate change is a code change and a
  CHANGELOG line.
- **D4 — Spending limit (R2, R3, Q8, Q11).** `MessagingSpend` per (org, IST month); limit stored on
  `MessagingSettings`; Raise limit and Send held release held rows in order, re-running D1's checks.
  The shop is told once per month on reaching it (a guard column).
- **D5 — Templates (R5–R7, Q3, Q5, Q7).** `Template(id, orgId, name, language, category,
  components JSON, metaId, status, rejectionReason, qualityPausedUntil, price snapshot, isStarter,
  archivedAt)`, unique (orgId, name, language). Submission through `TemplateSubmission` rows
  (idempotent by name); `TemplateStatus` facts keep status in step; a daily look backstops.
  `campaigns.submit-starters` submits the starter set (English and Hindi; reviewed Hindi in code),
  only what is missing. Editor's blanks are typed (`CUSTOMER_NAME`, `PRODUCT`, `PRICE`,
  `SHOP_NAME`) and rendered from live data at send.
- **D6 — Messaging settings (R8, Q13, Q112).** `MessagingSettings(orgId PK, limitPaise nullable
  (null = no limit), hours JSON per weekday, howOftenDay, howOftenWeek, greetingDelay, botPauseHours,
  alertsPerProduct, version)`; quality from `phone_number_quality_update` via channels' health.
- **D7 — Who did what (R9).** Every settings change, template submit and archive writes the audit log
  (`server/shared/audit/`).

## Packages
None.

## UI approach
ux.md's Messaging page in Shop details (`/org/[orgId]/shop/details/messaging`), limit sheet (shared
with connect-whatsapp), hours editor, Advanced fold, templates list and editor with a live WhatsApp
preview. Server components; leaves for the forms (`useServerForm` with the Zod schemas). Words in
`campaigns-copy.ts`.

## Gates touched
New domain `campaigns`; routes settings, limit, hours, templates CRUD, send-held; module-boundaries
rule for `sendTemplate`; `MAY_USE_SHEET`; one repository each.

## Data model
[MIGRATION] `MessagingSettings`, `Template`, `TemplateSubmission`, `WhatsAppSend`,
`MessagingSpend`, `MarketingTouch(orgId, contactId, at, channel, sourceRef)` with index
`(orgId, contactId, at)`.

## API / contract changes
[CONTRACT] `deliverByWhatsApp` and its answers; `limitSet`, `hoursFor`.

## Test plan
- Not opted in → skipped, nothing reserved (A2); at the limit → held, raise releases (A3).
- How-often under concurrency: two marketing sends for one buyer in one second, one goes.
- Utility bypasses how-often, not consent or spend (A6).
- Spend settles to the status's price in paise; sums are integers (100% branches: money).
- Starter submission idempotent across reconnects (A4); copy-and-edit submits In review (A5).

## Delivery
1. **after consent-core U1 (`may`)** — Settings, rates, spend, the port with consent and how-often (behaviour).
2. **after U1 and connect-whatsapp U2 (a connected number and its `messages` lane)** — Send job, statuses, settlement.
3. **after U1 and connect-whatsapp U2 (the setup job asks for `campaigns.submit-starters`)** — Templates and starters.
4. **after U2 and U3** — Messaging page, limit sheet, templates UI.

## Open questions
None.
