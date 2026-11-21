# TRD — social-selling/connect-whatsapp

- **Status:** Draft
- **Domain:** channels
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [spec.md](spec.md), [ux.md](ux.md) (draft), [decisions.md](decisions.md), parent [decisions](../decisions.md), [connect-instagram trd.md](../connect-instagram/trd.md), [INTEGRATIONS.md](../../../INTEGRATIONS.md#acting-for-a-shop-on-meta-catalogue-whatsapp-instagram), [ADR-0068](../../../adr/0068-meta-is-a-connected-shopfront.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
WhatsApp is the second `social` channel (ADR-0068) on the same `ChannelConnection` row and
`ConnectionProvider` that connect-instagram extracts. The difference is the consent: Embedded
Signup runs in a Meta pop-up driven by Meta's JavaScript SDK, which hands the page a code and the
chosen WhatsApp account and number ids. The page posts them to our server, which trusts none of it
until Meta confirms: the code is exchanged server to server, and the ids are checked against what
the exchanged token can see. Setup (register, subscribe) runs inside that request, and the row is
written connected only when every step succeeded. One signed webhook route in `channels` receives
WhatsApp's events for every shop (parent Q7); this subfeature handles `account_update` and lets
later subfeatures claim the rest.

## Prior art
- **Embedded Signup** (Meta's docs, v4): SDK `FB.login` with `config_id`, `response_type: code`,
  `override_default_response_type`, and `extras` carrying `featureType: whatsapp_business_app_onboarding`
  for coexistence and the pre-fill; the session-info message gives `waba_id`, `phone_number_id`.
  Then `/oauth/access_token`, `/<phone_number_id>/register`, `/<waba_id>/subscribed_apps`. Followed.
- **Twilio, 360dialog** (Tech Provider guides) confirm the token is a business-integration system
  user token with no refresh and no expiry; health is a read, not a renewal. Followed.
- **Webhooks** are at-least-once with `X-Hub-Signature-256`; idempotency by event id is Meta's own
  advice. Followed by D7.
- Departure: Meta's sample code trusts the ids from the browser message. We verify them with
  `debug_token`'s granular scopes, since a forged message is otherwise unchallenged (spec hazard 1).

## Technical decisions
- **D1 — `CHANNEL.WHATSAPP`, kind `social`.** `providers/whatsapp/` implements `ConnectionProvider`;
  `consentUrl` is replaced by `consentConfig` (app id, `config_id`, pre-fill, signed `state`)
  because the consent is a pop-up, not a redirect. The other verbs are unchanged in shape.
- **D2 — Pre-fill** from the org profile (name, email, website = `appUrl` store link) (parent Q12).
- **D3 — `POST /api/org/[orgId]/channels/whatsapp/connect`** (`withOrg`, Zod body: `code`,
  `wabaId`, `phoneNumberId`, `state`). Verifies `state` (shop, user, ten minutes; channel-connectors
  D4); exchanges the code; calls `debug_token` and refuses unless the granted `whatsapp_business_management`
  target ids include `wabaId`; reads the number under that WABA and refuses unless it matches.
- **D4 — Setup is all or nothing.** After verification: register the number (a random six-digit
  PIN, kept encrypted for re-registration), subscribe our app with the coexistence fields (Q5),
  read display name, quality and `account_review_status`, and the WABA's payment method. Only then
  one transaction writes the row CONNECTED and enqueues `whatsapp.connected` (orgId, connection id),
  the job the WhatsApp subfeatures start from. A job type registers once, so its one handler lives
  in `channels` (a no-op here); whatsapp-catalogue D1 adds catalogue creation to it and
  whatsapp-templates D3 adds enqueuing `campaigns.starter-set`. A reconnect enqueues it again; each
  step is idempotent. A failure after Meta's side succeeded unsubscribes
  (best effort) and answers `setup_failed`; nothing is stored. The request runs within Vercel's
  limit; each call has a 10-second timeout.
- **D5 — Identity.** `externalAccountId` = `phone_number_id`; `wabaId` stored alongside. Another
  shop's number is refused (`other_shop`), a different one on reconnect refused (`different_account`).
- **D6 — Limit.** The provider's `connectionCap` is replaced, for WhatsApp, by Meta's own answer:
  a signup refused for the onboarding limit answers `full`, and the card shows Full for now for 72
  hours after the last such answer for any shop (parent Q2). No count of ours (channel-connectors Q18).
- **D7 — One webhook route: `GET|POST /api/channels/whatsapp/webhook`.** GET answers Meta's verify
  challenge; POST verifies `X-Hub-Signature-256` with the app secret, writes each change to
  `MetaEvent` (unique per product on Meta's id or a hash of the change), and enqueues one job per new
  row by field: `whatsapp.account-update` and `whatsapp.quality-update` (`phone_number_quality_update`,
  sets `quality`; campaigns Q20 reads it) here; `whatsapp.messages` (inbound and statuses),
  `whatsapp.smb-echoes`, `whatsapp.contacts-sync`, `whatsapp.template-status`, each with one
  handler in `channels` that later subfeatures extend (inbox-whatsapp D1 owns `whatsapp.messages`;
  whatsapp-contacts and whatsapp-campaigns add their mappings to it), marked handled until those exist. `history` is dropped (parent Q12). Answers 200 fast;
  work is on the worker (ADR-0038). Whichever of this and inbox-instagram D1 lands first creates
  `MetaEvent`.
- **D8 — Daily check** in `channels.maintain`: `GET /<phone_number_id>` (quality, name status) and
  the WABA's payment method; a 190 or a missing subscription sets `NEEDS_RECONNECT`. No renewal (Q8).
  Every move to `NEEDS_RECONNECT` (here, D9) enqueues `channels.needs-reconnect`, as connect-instagram D6.
- **D9 — `account_update`** with `PARTNER_REMOVED` sets `NEEDS_RECONNECT` / `REVOKED` and nulls the
  token at once (Q8, spec hazard 5).
- **D10 — Disconnect** unsubscribes `subscribed_apps`, deregisters nothing (coexistence keeps the
  number on the app), nulls token and PIN (Q13).
- **D12 — Spend-cap step** (R6a, parent Q8): after a connected answer the button opens the cap
  sheet, which saves through whatsapp-campaigns' caps command (`WhatsAppCaps.monthlyCapPaise`).
  Until whatsapp-campaigns exists the step is not shown. Rupees convert to paise at the API client.
- **D13 — Moving a number** (parent Q12, parent Q12) needs no code path of ours: Meta's pop-up returns the
  same session info for its "new number" flow, and the card shows the before-you-move note on
  `featureType` other than coexistence. `smb_*` fields are then simply silent.
- **D11 — The switch.** `CHANNELS_CONNECT` gains `whatsapp`. Requires `META_APP_ID`,
  `META_APP_SECRET`, `WHATSAPP_ES_CONFIG_ID`, `META_WEBHOOK_VERIFY_TOKEN`, else unavailable.

## Packages
None. Meta's JavaScript SDK is loaded from `connect.facebook.net` by a script tag in the card's
client leaf (CSP entry added); it is Meta's required pop-up host, not an npm dependency.

## UI approach
Cites ux.md. The WhatsApp card is a `ConnectionCard` (connect-instagram). Its client leaf
`WhatsappConnectButton` loads the SDK on tap, opens the pop-up, listens for the session-info
message, and posts through `channelsApiClient.connectWhatsapp` via `useMutation`; then shows the
outcome note in place (no redirect). Phone: Meta opens a full tab; `md:` and up a window.
Masked number formatted on the server. Copy in `channel-copy.ts`. No new token.

## Gates touched
- `portal-boundary` — the connect route uses `withOrg`.
- `route-reachability` — the webhook in `EXTERNALLY_CALLED` (Meta).
- `rate-limiting` registry — connect: the org-write policy; webhook: exempt, signed, with reason.
- `request-body-parsing` — connect body and webhook envelope parsed with Zod.
- `one-repository` — `MetaEvent` written only by its repository in `channels`.
- CSP in `next.config` — `connect.facebook.net` script and frame, `facebook.com` frame.

## Data model [MIGRATION]
`ChannelConnection` gains `parentAccountId` (WABA id), `phoneDisplay` (masked), `displayName`,
`quality`, `paymentReady` (bool), `registrationPin` (encrypted). New `MetaEvent`: id, source
(`whatsapp` / `instagram`), external key (unique per source), field, org id (nullable until
matched), received at, handled at, job id. Kept 30 days, then deleted by `channels.maintain`.

## API / contract changes [CONTRACT]
`CHANNEL.WHATSAPP`; `ChannelCardDTO` gains `phoneDisplay`, `displayName`, `quality`, `paymentReady`;
`CONNECT_RESULT` gains `setup_failed`; the connect route and its body. CONTRACTS.md moves with it.

## Test plan
- Unit: state verified; `debug_token` without the WABA refused; number not under WABA refused;
  webhook signature verified, tampered refused; duplicate event written once; field routing; masked
  number; outcomes map to ux.md copy.
- Integration: setup failure after register leaves no row and unsubscribes; other shop's number and
  different number refused; `PARTNER_REMOVED` turns the card; daily check sets quality and payment;
  disconnect unsubscribes and nulls. `fetch` stubbed.
- Manual (A9, parent Q2, Q12): sandbox account, then the owner's coexistence number on dev, at 360px.

## Delivery (units)
1. `CHANNEL.WHATSAPP`, WhatsApp provider, connect route with verify and all-or-nothing setup, `whatsapp.connected` — behaviour-changing.
2. Webhook route, `MetaEvent`, routing; `account_update` handling.
3. Card, SDK button, outcome notes, disconnect, CSP.
4. Daily check, quality and payment lines, dashboard banner, `channels.needs-reconnect`.
5. Spend-cap step, once whatsapp-campaigns' caps command exists.

## Open questions
None.
