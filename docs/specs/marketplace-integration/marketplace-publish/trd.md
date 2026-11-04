# TRD — marketplace-publish

- **Status:** Implemented
- **Domain:** channels, with listing (mappings) and catalog (photos, stock)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-02
- **References:** [spec.md](spec.md), [ux.md](ux.md), [decisions.md](decisions.md), [channel-listings trd](../channel-listings/trd.md), [INTEGRATIONS.md](../../../INTEGRATIONS.md) "Editing and creating a listing", [ADR-0038](../../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md), [ADR-0045](../../../adr/0045-channel-mappings-are-versioned-data.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
Publishing is the reconciliation step channel-listings set up: the computed listing against what
was last sent, sent as only the fields that differ, then followed until the marketplace answers. The
review fixes exactly what is sent; a job sends it under a lock per listing; a self-renewing check
reads the answer; the answer lands on the fields. Creating is the same send with more fields, after
looking for the product's page on Amazon so it is never duplicated.

## Prior art
- **Amazon's own guidance:** patch to edit (a put replaces the whole listing), check-only mode before
  a create, issues read back by polling without a queue. We follow all three.
- **Multichannel tools** (3Dsellers, Zentail, Listing Mirror): per-listing status plus per-field
  issues, marketplace-raised and ours told apart, retries never silent. We follow them.
- **GitHub checks:** progress and conclusion are separate fields. Our state and its result are too.

## Technical decisions
- **D1 — Two provider verbs**, `publishListing(ref, changes | create)` and `listingStatus(ref)`, plus
  `findPages(query)` for Amazon. Answers are one shape: accepted, issues (code, message, severity,
  our field or none), what the marketplace shows (title, main photo), live or paused.
- **D2 — Only what differs is sent.** Amazon: one `patchListingsItem` with an operation per changed
  field; price as a `merge` of `purchasable_offer` with its selectors; pause as the offer's `end_at`
  (Q17). A create is a `putListingsItem`, the one place a whole listing is sent. Flipkart: price by its
  price update in whole rupees, rounded down (channel-listings Q13), with the product's MRP; pause by
  its listing status. Paise to rupees in one helper beside `paiseFromRupees`. Our photos are stored as
  WebP, which Amazon refuses, so a photo in a refused format goes as a JPEG rendition on white
  (`marketplaceJpeg`, made once and kept); a photo set with none left to send is refused on Photos.
- **D3 — The review is a fingerprint.** The review page carries each listing's `version`; Publish
  sends the ids, versions and the fields the shop kept. The service refuses a listing whose version
  moved (Refused state) and records the publish as the computed values of the kept fields, so a later
  edit is never sent unseen. The claimed state is the lock: the marketplace is called outside any
  transaction and the answer is recorded only while the listing is still Sent, so a retry resends the
  same patch; `sent` gains only the fields the marketplace accepted, Amazon's after a look confirms them.
  Every outcome is recorded; a send the queue gives up on is ended by the daily pass.
- **D4 — One job per listing**, `channels.publish-listing`, enqueued in the publish transaction and
  grouped per org (ADR-0038's fairness); a busy marketplace throws and the queue retries; listings
  calls are 5 a second per seller, so fifty listings take seconds.
- **D5 — The check renews itself** (inventory-sync Q23): after a send, each listing is due at 2, 10,
  30 and 120 minutes, and one `channels.check-listings` job claims what is due and re-enqueues only
  while something waits. The answer is a complaint at any look, or the listing found clean at the
  second look;
  the daily maintain pass checks anything still pending, and after the last check the listing reads
  "Amazon hasn't answered". Flipkart's answer is the send's own, so it needs no check.
- **D6 — "Put on Amazon" searches first:** catalog items by barcode, then by the product's name. Sell
  on an existing page sends an offer-only listing; a new page sends the full listing in check-only
  mode first and only creates when no error came back (Q9). The new listing's mirror row is written
  linked to the product at once, so stock sync and reads take it up with no Read again.
- **D7 — A family goes up parent first.** The family's listing (a `PlatformListing` on the family,
  not a product) is created with its variation theme, read from Amazon's schema for the type; each
  member then as a child. A member that fails leaves the others and the parent standing, each with its
  own state; publishing again sends only what is not yet accepted.
- **D8 — The forward mapping** is channel-registry's mapping read the other way: a fact's answer to
  Amazon's attribute and value, from the same versioned rows marketplace-facts reads back (ADR-0045).
  Compliance attributes come from the brand and the shop's listing defaults (Q19).
- **D9 — An issue's message** is kept as plain text, cut to 300 characters, never the response body
  (Q6); its code is stored for us. `attributeNames` map to our fields through the provider.

## Packages
None.

## UI approach
Cites ux.md. The review is a server page with one client leaf (undo per line, Publish) through
`channelsApiClient` and `useMutation`. Status lines are a server component shared by the listing
screen, the On marketplaces block and the Listings rows. Put on Amazon is a page; matches render as a
list on the phone and a two-column grid from `md:`.

## Gates touched
- `one-repository` — publish writes `PlatformListing` through its repository and the mirror through `channelListingRepository`.
- `module-boundaries`, `file-cohesion` — the forward mapping reads listing's public mapping service.
- `route-reachability`, `portal-boundary` — the review, publish, find and create routes through `withOrg`.
- worker registrations — the two new jobs.

## Data model [MIGRATION]
`PlatformListing` gains publish state, issues, what the marketplace shows, check count and next check,
creation mode and target page, and a nullable family. Nothing dropped.

## API / contract changes [CONTRACT]
Review and status DTOs; `POST …/channels/[channel]/publish`, `GET …/products/[id]/listings/[channel]/pages`,
`POST …/products/[id]/listings/[channel]` (create draft), family create.

## Test plan
- Unit: the patch built from changes (price merge, pause, photos); issues to fields; rupee rounding.
- Integration: a stale version is refused; only kept fields are sent and recorded; a refused field
  stays waiting with its issue; a check renews itself and stops; the family goes parent first and a
  failed member leaves the rest; a create in check-only mode with an error creates nothing.
- Providers: stubbed `fetch` only.

## Delivery (units)
1. Provider verbs (Amazon, Flipkart), the publish service, jobs and checks.
2. The review page, publishing one listing and all, statuses everywhere.
3. Put on Amazon: search, sell on a page, a new page, a family.

## Open questions
None.
