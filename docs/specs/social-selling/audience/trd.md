# TRD — social-selling/audience

- **Status:** Accepted
- **Domain:** audience, with checkout (the box) and storefront (the button)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-23
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](ux.md), the architecture [TRD](../trd.md), [consent-core TRD](../consent-core/trd.md), [whatsapp-sending TRD](../whatsapp-sending/trd.md), the bulk sheet's file handling (`server/catalog/` bulk upload)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
The Customers page over consent-core's contacts: figures, filters, picked and filtered lists, the
first offer to contacts who arrived Not yet, files of contacts, and the two buyer-side ways in.
Lists are never copies of who may be messaged: a list counts and sends only its opted-in members at
the moment it is used.

## Prior art
- **Saved segments as queries** (Klaviyo, Mailchimp segments) versus **static lists** (Mailchimp
  audiences): both exist in the field for different jobs. Followed: filter lists are queries
  re-evaluated live, picked lists are memberships; both are filtered by consent at use (Q17, Q21).

## Technical decisions
- **D1 — Checkout box (R2, Q8 parent Q27).** Checkout shows one unticked box with the wording
  version `checkout-consent.v2` ("I agree to get offers from <shops> and, separately, from Bhendi
  Bazaar…"); the order stores the tick and version. On payment confirmed, checkout enqueues the shared
  job `audience.checkout-opt-in(orderId, shops, phone, email, version)`; audience writes one
  consent event per shop and for the platform, each channel, evidence = order id. Checkout imports
  nothing from audience.
- **D2 — Store button (R3, Q10).** The storefront renders "Get offers on WhatsApp" as a `wa.me`
  link with `YES` prefilled to the shop's number when WhatsApp is connected; the opt-in is the
  inbound YES (consent-core D3).
- **D3 — Files (R4, Q15).** Upload through the bulk sheet's reader (CSV/XLSX, ≤5,000 rows), column
  match, preview counts, then `audience.import-contacts` job in pages of 500: E.164 normalisation
  (`server/shared/phone.ts`), invalid skipped and counted, stop markers honoured, upsert as Not yet.
  Progress on an `ImportRun` row.
- **D4 — Lists (R5, Q17, Q21).** `ContactList(id, orgId, name, kind FILTER|PICKED, filter JSON,
  version)` and `ContactListMember(listId, contactId)` for picked lists. A filter compiles to one SQL
  query over contacts joined with orders, wishlist and consent (through each domain's public read
  service, composed in a read model in audience); counts use the same query with `count(*)`.
  Picked from a selection: `SelectionBar` posts contact ids (≤5,000) or "all matching this filter",
  resolved server-side.
- **D5 — First offer (R8, Q20, consent-core Q11).** `audience.first-offer(orgId, runId)` pages Not
  yet contacts with `firstOfferAt` null and a WhatsApp identity, claims each (consent-core D5), and
  calls `deliverByWhatsApp` with the first-offer template and the chosen product, purpose MARKETING,
  at up to 100 a day per shop (a daily budget on `FirstOfferRun`), resuming the next day. The run's
  counts (sent, yes, stop, no answer) are read from consent events by source.
- **D6 — Masked numbers (R6, Q19).** The list DTO carries the last four digits only; Show calls a
  route that returns the number and writes the audit log; no export route exists.
- **D7 — Sync status (R7).** Read from the connection's `contactSyncStartedAt` and the count of
  synced contacts.

## Packages
None.

## UI approach
ux.md's Customers page (`/org/[orgId]/customers?tab=audience|campaigns`): server-rendered figures and
first page; client leaves for chips, selection (`SelectionBar`), file sheet, first-offer sheet and
list editor. Rows on a phone, table from `md:`. Words in `audience-copy.ts`.

## Gates touched
Routes contacts, show-number, import, lists, first-offer; checkout and storefront changes reviewed
under their domains' rules; `MAY_USE_SHEET`; one repository each.

## Data model
[MIGRATION] `ContactList`, `ContactListMember`, `ImportRun`, `FirstOfferRun(orgId, templateId,
productId, startedAt, sentToday, dayStartedAt, state)`; order columns `offersConsent`,
`offersConsentVersion`.

## API / contract changes
[CONTRACT] Shared job `audience.checkout-opt-in`; list read for campaigns (`listMembersMayReceive`).

## Test plan
- Checkout tick → consents for each shop and the platform after payment (A1); untick → none.
- Store button YES opts in (A2).
- File of 200 → 196 Not yet, 4 skipped (A3); stopped stays stopped.
- Filter list counts only opted-in (A4); picked list (A7).
- First offer: 100 a day, once per contact, results counted (A6).
- Show number audited (A5).

## Delivery
1. Contacts page, figures, masked numbers (UI over consent-core).
2. Checkout box and store button (behaviour).
3. Lists (filter and picked).
4. Files and first offer.

## Open questions
None.
