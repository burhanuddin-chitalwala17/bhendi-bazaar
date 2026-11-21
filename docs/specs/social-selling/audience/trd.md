# TRD — social-selling/audience

- **Status:** Draft
- **Domain:** audience (new)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [spec.md](spec.md), [ux.md](ux.md) (Draft), [decisions.md](decisions.md), parent [decisions](../decisions.md), [ADR-0024](../../../adr/0024-phone-is-contact-data-not-an-identity-key.md), [ADR-0033](../../../adr/0033-a-domain-is-reached-through-its-public-surface.md), [ADR-0038](../../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md), [ADR-0046](../../../adr/0046-a-new-model-is-checked-against-the-field-before-the-codebase.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
A new platform-free domain, `server/audience/`, owns contacts, consent and lists (parent Q7). It
answers one question for every sender and channel, `consentFor(sender, phone, channel)`, and records
consent from neutral jobs: checkout's opt-in at payment, and channels' "message received" and
"contacts synced". It imports neither checkout nor channels; both reach it only through the queue.
Lists are saved filters evaluated at read time, so a stop is honoured by every list the instant it
is written. Audience counts no sends: caps are the WhatsApp send's and notification-hub's (parent Q40).

## Prior art
- **Consent as an append-only ledger.** Twilio's and Braze's subscription models, and the
  IAB/GDPR consent-receipt practice (Kantara Consent Receipt spec), store each grant and withdrawal
  as an event with source and proof, and derive current state. We follow: `ConsentEvent` rows are
  never updated; the current state is the latest event per (sender, channel, contact).
- **Suppression lists** (Mailchimp, SendGrid, Meta's own opt-out guidance): a stop outlives the
  contact so a re-import cannot undo it. We follow with a hashed-phone suppression row (Q21).
- **Segments as saved queries** (Klaviyo, Braze) rather than static copies, re-evaluated at send.
  We follow (Q17). Static lists exist only as an upload's membership.

## Technical decisions
- **D1 — Domain `server/audience/`.** Public surface: `audience.service` (consent question, lists,
  upload, Audience page reads, deletion) and `audience.types`. Jobs in `audience.jobs.ts`; specs in
  `server/shared/jobs/` so enqueuers never import audience.
- **D2 — Phones are normalised once**, with `normalizePhone` (`server/shared/phone.ts`), to E.164
  before any read or write; an invalid phone is rejected at the boundary (Hazard: two formats).
- **D3 — Consent is a ledger.** `ConsentEvent`: sender kind (shop or platform) and sender id,
  channel, contact, action (opt-in, stop), source (`CONSENT_SOURCE`: checkout, store-page, chat,
  upload), evidence id, wording version, actor (user id for uploads), at. A unique key on
  (sender, channel, source, evidence id) makes a redelivered job a no-op (Hazard: two webhooks).
  Current state is the latest event, read by a `DISTINCT ON` query; no state column to drift.
- **D4 — The send-time answer.** `consentFor` reads the latest event inside the caller's
  transaction. The WhatsApp send (whatsapp-campaigns) calls it immediately before calling Meta, in
  the same unit of work that claims the send; a STOP committed earlier is always seen (Hazard: race).
- **D5 — Suppression.** `ConsentSuppression`: sender, channel, SHA-256 of the E.164 phone with a
  server pepper, at. Written by every stop and every deletion; checked by upload and by `consentFor`.
  An upload row matching it is imported Stopped (Q13, Q21).
- **D6 — Checkout's box.** Checkout gains a boolean on the order and the wording version; the order
  schema accepts `marketingOptIn: boolean` (Zod, Invariant 4). `payment-confirmed.ts` enqueues
  `audience.checkout-opt-in` with order id, shop ids, phone, email, wording version and the
  confirmation time, in the same transaction (Q5, Q8). The box component lives in
  `src/components/checkout/` and takes its words from `checkout-copy.ts`; it knows nothing of audience.
- **D7 — Inbound words.** `audience.message-received` (from channels, whatsapp-contacts D2) is
  matched against `OPT_IN_WORDS` and `STOP_WORDS` (closed sets in `audience.types`): whole-message,
  trimmed, case-folded, Unicode-normalised (Q10, Q13). A match writes the event and enqueues
  `channels.whatsapp-confirm` (a neutral "send the confirming reply" job channels handles).
- **D8 — Email unsubscribe.** `unsubscribeLink(sender, channel, contact)` signs a non-expiring token;
  notification-hub puts it in every marketing email (hub-core D8). `GET /api/audience/unsubscribe/[token]`
  writes a stop and shows hub-core's page. Public, under the existing `public-write` policy.
- **D9 — Lists.** `AudienceList`: shop, name, filter (Zod-parsed JSON: category ids, wishlisted,
  last-order days, upload id), created by. Membership is computed: opted-in WhatsApp contacts of the
  shop, intersected with checkout's `buyersOf(shop, {categoryIds, sinceDays})` and wishlist's
  `wishlistersOf(shop, {productIds?})` reads, which return phones only (Q5). Counts are live; no member table.
- **D10 — Upload.** `POST /api/org/[orgId]/audience/uploads` (`withOrg`) accepts the parsed rows
  from the client (the bulk-sheet reader in the browser), validated with Zod (≤5,000 rows); the
  attestation is a row (`AudienceUpload`: file name, row counts, attested, by, at) and the consent
  events cite it as evidence (parent Q9).
- **D11 — Phone masking and reveal.** Reads return the last four digits; `POST …/contacts/[id]/reveal`
  returns the full phone and records it with `recordAdminActionIn` (audit never fails the action, ADR-0021) (Q19).
- **D12 — Deletion and retention.** `audience.forget(phone)`, run by the handler of
  `channels.person-deleted` (connect-instagram D8) and by the admin's user-deletion path, deletes
  contacts and events for that phone at every shop, writes suppression rows and enqueues
  `inbox.person-deleted` for it. A daily slot
  in the existing schedule deletes contacts of shops whose last messaging channel disconnected 90
  days ago, and consent events three years after their contact's last consent change (Q21).
- **D13 — Hindi preference** is a column on the contact, so per shop (parent Q37), matched like opt-in words.

## Packages
None. Spreadsheet reading reuses the bulk-sheet's existing reader.

## UI approach
Cites [ux.md](ux.md); states and copy are there.
- **Per form factor:** phone first: Audience is one column, counts strip, then contacts list with
  chips; Lists a second tab. `md:` puts lists beside contacts; `lg:` adds a contact detail panel.
- **Rendering:** `/org/[orgId]/audience` is a server page reading `audience.dal.ts`. Client leaves:
  `ContactSearch`, `UploadSheet`, `ListEditor`, `RevealPhoneButton`, `OptInBox` (checkout),
  `StoreOptInButton` (a plain link; server-rendered).
- **Behaviour:** `audienceApiClient.ts` (upload, list save, reveal) via `useMutation` /
  `useServerForm`; list counts via `useAsyncData`.
- **Surfaces:** upload and list editor are handed-off sheets (ADR-0040: bottom sheet on phone, dialog
  from `md:`); chips on `StatusBadge`. No new token.

## Gates touched
- `module-boundaries` — `audience` in `PUBLIC_SURFACE`; checkout and channels never import it.
- `docs-integrity` — the new domain's CLAUDE.md in `LIVING_DOCS`; root CLAUDE.md domain table.
- `portal-boundary` — every `/api/org/**/audience/**` route uses `withOrg`.
- `route-reachability` — unsubscribe in `EXTERNALLY_CALLED` (linked from email).
- rate-limit registry — unsubscribe classified `public-write`.
- `one-repository` — `Contact`, `ConsentEvent`, `ConsentSuppression`, `AudienceList`, `AudienceUpload`
  each written by one repository.
- `file-cohesion` — `audience.service` reaches checkout and wishlist only (two domains).
- `request-body-parsing` — upload, list and order schemas in `src/lib/validation/schemas/`.

## Data model [MIGRATION]
`Contact` (shop, phone E.164, name, email, language, removed-from-phone, created, unique (shop,
phone)); `ConsentEvent` as D3; `ConsentSuppression` as D5; `AudienceList` as D9; `AudienceUpload` as
D10. `Order` gains `marketingOptIn` and `marketingOptInWording`. Nothing cascades from `Org` (ADR-0020).

## API / contract changes [CONTRACT]
`ConsentAnswerDTO`, `ContactDTO`, `AudienceListDTO`, `CONSENT_SOURCE`; the order-create schema's
`marketingOptIn`; the jobs `audience.checkout-opt-in`, `audience.message-received`,
`audience.contacts-synced`. CONTRACTS.md gains an "Audience" section.

## Test plan
- Unit: phone normalisation merges formats; opt-in and stop words match only whole messages, Hindi
  included; current state from a ledger with out-of-order events; list filter parsing.
- Integration: checkout tick → paid → consent for each shop and the platform on both channels;
  unpaid → none; redelivered job → one event; STOP then `consentFor` in one transaction → no;
  upload with suppressed phone → Stopped; deletion → no contact, upload stays Stopped; list count
  drops on stop; audience never imports checkout (boundary test).
- Manual: A1–A8 at 360px on dev, guest checkout and the owner's own phone for YES and STOP.

## Delivery (units)
1. Schema, migration, repositories, ledger and `consentFor` — no route, no behaviour.
2. Checkout box, order flag, opt-in job — behaviour-changing (buyers see the box).
3. Audience page: contacts, chips, reveal; past buyers count.
4. Upload with attestation; suppression.
5. Lists and their live counts; checkout's `buyersOf` and wishlist's `wishlistersOf` added to their public services.
6. Inbound words job, unsubscribe route, deletion and retention slot.

## Open questions
None. Q8, Q21, parent Q37 decided by the owner 2026-11-06.
