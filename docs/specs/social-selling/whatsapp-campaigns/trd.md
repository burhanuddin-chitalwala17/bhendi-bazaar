# TRD — social-selling/whatsapp-campaigns

- **Status:** Accepted
- **Domain:** campaigns
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-23
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](ux.md), the architecture [TRD](../trd.md) (A-D8–D10, D13, D14, D17), [whatsapp-sending TRD](../whatsapp-sending/trd.md), [audience TRD](../audience/trd.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
A campaign is an authored record with a recipients snapshot made at review and re-checked at send.
Sending is a resumable job that walks the recipients in pages and hands each to
`deliverByWhatsApp`, paced on the shop's campaign lane, so a 10,000-person campaign finishes in
minutes, can be stopped, and never charges for what it did not send.

## Prior art
- **Batch sends as a cursor over a snapshot with per-recipient rows** (Braze, Customer.io): the
  snapshot fixes "who was confirmed", per-recipient rows make stop, resume and the report exact.
  Followed, with Q3's rule that a send never reaches more people than confirmed.

## Technical decisions
- **D1 — Model (R1, R7).** `Campaign(id, orgId, name, templateId, values JSON, productIds (≤30),
  listId, state DRAFT|SCHEDULED|SENDING|STOPPED|DONE|LATE|CANCELLED, scheduledAt, confirmedCount,
  estimatePaise, version, createdById, scheduledById, startedById, stoppedById, timestamps)`;
  `CampaignRecipient(campaignId, contactId, state PENDING|SENT|SKIPPED|FAILED|NOT_SENT, reason,
  sendId)`, PK (campaignId, contactId).
- **D2 — Review (R2, Q3).** `POST …/campaigns/[id]/review` evaluates the list through
  `listMembersMayReceive` (consent and how-often preview, no reservation) and returns counts by
  reason, the estimate from rates in paise and the month's spend; nothing is written but the draft.
- **D3 — Confirm (R3).** `POST …/send` or `…/schedule` re-runs review, writes the recipient snapshot
  (`INSERT … SELECT` in one statement, ≤ 100,000 rows) and `confirmedCount`, sets the state and
  enqueues `campaigns.run(campaignId, version)` now or with `startAfter`.
- **D4 — Run (R3, R5, A-D9).** Claims the connection's `campaign` lane; pages 500 `PENDING`
  recipients; for each calls `deliverByWhatsApp` (which re-checks consent, how-often and spend, so
  the count never exceeds the snapshot and anyone who stopped since is skipped); updates the
  recipient. Pace 20 a second (meta-limits), slowed by headers; checkpoints are the rows themselves,
  so a crash resumes where it stopped. Stop sets `STOPPED`; the run checks state per page and marks
  the rest `NOT_SENT` (not charged). A run more than 6 hours late (found by the sweep) becomes `LATE`
  for the shop (Q13).
- **D5 — Report (R6, Q14).** Counts by recipient state and by the send's delivery status; actual
  cost is the sum of settled sends; button taps from `InboundMessage` button payloads carrying the
  campaign ref. Read by grouped queries on `(campaignId, state)`.
- **D6 — Products (R4).** Multi-product messages reference catalogue retailer ids; the catalogue
  shows page prices (whatsapp-catalogue), so the message never states a price of its own.

## Packages
None.

## UI approach
ux.md's Campaigns tab, one-page editor (full page on a phone, `TaskDialog` from `lg:` with preview
beside), review sheet with the money on the button, report with progress through `useChangeFeed`.
Words in `campaigns-copy.ts`.

## Gates touched
Routes campaign CRUD, review, send, schedule, stop, cancel; `MAY_USE_SHEET`.

## Data model
[MIGRATION] `Campaign`, `CampaignRecipient` (D1); indexes `(orgId, state, scheduledAt)`,
`(campaignId, state)`.

## API / contract changes
None beyond whatsapp-sending's port and audience's list read.

## Test plan
- Review counts by reason (A1); schedule recounts and never exceeds the snapshot (A2).
- Stop half-way: unsent not charged, report says so (A3); crash mid-run resumes without a duplicate.
- Report counts and cost from settled sends (A4).
- Load: 10,000 recipients in under 10 minutes against the fake source (A-D17).

## Delivery
1. Model, review, confirm (behaviour).
2. Run, stop, resume, late.
3. Report; UI.

## Open questions
None.
