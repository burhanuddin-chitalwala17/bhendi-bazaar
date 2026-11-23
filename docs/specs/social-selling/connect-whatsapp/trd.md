# TRD — social-selling/connect-whatsapp

- **Status:** Draft
- **Domain:** channels
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-23
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](ux.md), the architecture [TRD](../trd.md), [meta-foundation TRD](../meta-foundation/trd.md), [whatsapp-sending TRD](../whatsapp-sending/trd.md) (the spending limit), [consent-core TRD](../consent-core/trd.md) (contacts), [ADR-0035](../../../adr/0035-every-response-carries-a-nonce-based-csp.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
WhatsApp connects through Meta's Embedded Signup pop-up, in coexistence mode by default so the
Business app keeps working. The pop-up returns a code and the WhatsApp account and phone ids; the
server exchanges the code for a business integration token and makes the number ready in a
background job with visible progress, because the steps after the pop-up take seconds to a minute
and must survive a closed tab.

## Prior art
- **Embedded Signup** (Meta's Tech Provider flow): the Facebook JS SDK's `FB.login` with a
  configuration id, `response_type: code`, and the session-info message event carrying the account
  and phone ids; the code exchanged server-side for a token that does not expire on a clock. The
  coexistence variant (`featureType` for the Business app) adds the contact and history sync calls.
  We follow Meta's guide; the spike confirms the exact calls coexistence needs on our sandbox.
- **Setup as a resumable job** with a step cursor, rather than one long request: the pattern of our
  listing read (`listing-read.job.ts`), followed.

## Technical decisions
- **D1 — The pop-up (R1, R4).** A client leaf loads Meta's SDK only when the card's Connect is
  tapped (no global script), with a per-request CSP nonce; the CSP gains Meta's SDK host in
  `script-src` and Facebook's in `frame-src` and `connect-src`, the one change to
  the policy in `src/lib/security-headers.ts`, recorded in ADR-0035's allow list with its reason. Before opening, the
  server issues a signed `state` (connect-state.ts) stored with the attempt; the session-info event
  and the code are posted back with it to `POST api/channels/whatsapp/signup`; a result without a
  live, unused `state` for this shop and member connects nothing (A3).
- **D2 — Exchange and claim (R5, Q10).** The route exchanges the code, reads the phone's number and
  account, and in one transaction under the shop's connection row lock applies the uniqueness rules
  (the index on external phone id; a different number on reconnect refused), then writes the
  connection `SETTING_UP` with the sealed token and enqueues `channels.whatsapp-setup`. It answers at
  once; the card polls (A-D14).
- **D3 — Setup job (R6, R7, Q5, Q17).** Idempotent steps with a cursor on the connection, each
  re-runnable: subscribe our app to the account's webhooks; for a coexistence number start the
  contact sync once (recorded with its time, never twice for one onboarding; consent-core Q12) and
  skip history (parent decision: no chat history); for a new number register it with a random
  six-digit PIN kept sealed; read display name, quality, payment method and messaging tier into
  `healthJson`; ask campaigns to submit the starter templates (shared job
  `campaigns.submit-starters`); ask catalogue to begin (shared job `channels.catalogue-begin`, which
  waits for import's settle when the shop had a catalogue). Done → `CONNECTED`, notification
  "WhatsApp connected". A step failing with an auth error → `NEEDS_RECONNECT`; temporary → queue
  retry with backoff; after its retries → `SETUP_FAILED` with the return note's text (R9).
- **D4 — Weekly limit (R13).** Meta's onboarding cap answers a known error at exchange; the
  connection is not created and the card shows Full for now with Meta's reset date where given.
  A platform-wide `MetaOnboardingCount(week, count)` row also feeds the admin overview.
- **D5 — Health (R9–R11, Q8).** From `account_update`, `phone_number_quality_update` and the
  daily pass: quality, payment method, `OFFBOARDED`, `PARTNER_REMOVED`. Each change that needs
  the shop emits `connection needs you`. Nothing is renewed: the token does not expire on a clock;
  a 190 sets Needs reconnecting.
- **D6 — The spending limit step (R8).** The card's checklist reads whatsapp-sending's
  `limitSet(orgId)`; the sheet is whatsapp-sending's component; connect only routes to it after
  `CONNECTED`.
- **D7 — Disconnect (R12, Q13).** Unsubscribe our app from the account, delete the token, keep the
  record; for a number we registered (not coexistence) deregistration is not called, so the shop's
  number keeps its history; inbox and catalogue are told through their public close hooks.

## Packages
None (Meta's SDK loads from Meta's host at tap time; not an npm dependency).

## UI approach
ux.md's card, Meta pop-up start, Setting up, spending-limit sheet (whatsapp-sending's), checklist,
health and disconnect. The Connect button is a client leaf that lazy-loads the SDK and shows
"Opening Meta…", then "Finish in the Meta window…"; the card polls its status while `SETTING_UP`.
On a phone Meta's window is a full tab; the return lands on Channels with the result code. Shared
`channel-setup-checklist.tsx` with Instagram. Words in `channel-copy.ts`.

## Gates touched
Routes signup, status, check-now; CSP allow list (D1) with its reason; rate limiting under the
OAuth policy; one repository each for `MetaOnboardingCount`.

## Data model
[MIGRATION] Connection `state` gains `SETTING_UP` and `SETUP_FAILED`; `setupCursor`,
`contactSyncStartedAt`, `registeredPinSealed`; `MetaOnboardingCount(week PK, count)`.

## API / contract changes
[CONTRACT] Shared job specs `campaigns.submit-starters` and `channels.catalogue-begin`.

## Test plan
- Signup: valid; replayed or forged result (A3); number in another shop, different number (A4).
- Setup job: each step re-run after a crash at every step leaves one subscription, one sync start,
  one registration; a 190 at any step → Needs reconnecting.
- Health facts from recorded `account_update` payloads: offboarded (A6), no payment method (A5).
- Disconnect: no credential remains (A7).
- CSP: the nonce test still passes with the added hosts; no `unsafe-inline`.

## Delivery
1. CSP, SDK leaf, `state`, signup route (behaviour: connection Setting up).
2. Setup job and health (behaviour: Connected).
3. Card states, checklist, disconnect (UI).

## Open questions
None.
