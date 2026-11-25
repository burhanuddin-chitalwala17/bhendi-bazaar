# TRD — notification-hub/notifications-core

- **Status:** Accepted
- **Domain:** notifications
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-23
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux.md](ux.md), [../decisions.md](../decisions.md) (Q1, Q3), [ADR-0069](../../../adr/0069-notifications-are-one-hub-every-module-plugs-into.md), the social-selling architecture [TRD](../../social-selling/trd.md), the shipped notice pipeline (`server/notifications/notice.service.ts`)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
The hub ADR-0069 describes, built on the pattern `Notice` already proves: an event is a row written
in the emitter's transaction, a delivery per (event, recipient, channel) is unique, and only a new
delivery enqueues a send. Channels are plugs behind one port; this subfeature ships email and the
badge, and the at-once and daily-digest timing. Parcel notices move onto it unchanged.

## Prior art
- **Notification services** (Knock, Novu, Courier): workflow per event kind, channel steps,
  digest windows, a per-recipient feed with read state. We follow the model in-house (ADR-0069 says
  why), keeping to what the specs need: badge feed, at-once email, daily digest.
- **Our `Notice`** row-first pattern: right, extended rather than replaced.

## Technical decisions
- **D1 — Events.** `notificationsService.emit(tx, { kind, orgId, audience SHOP_MEMBERS|BUYER,
  recipientRef, facts, eventKey })` inside the emitter's transaction; `NotificationEvent(eventKey
  UNIQUE, kind, orgId, facts JSON (ids, never message bodies), createdAt)`. Kinds are a closed set
  (`NOTIFICATION_KIND`); a module never names a channel (R1).
- **D2 — Deliveries (R2, Q3).** `Delivery(id, eventKey, recipientId, channel, timing AT_ONCE|DIGEST|
  BADGE, state PENDING|SENT|FAILED|SKIPPED|SUPERSEDED, reason, providerId, at)`, unique (eventKey,
  recipientId, channel). Policy per kind in `notifications/policy.ts` decides channels and timing
  (`post due` → BADGE + email AT_ONCE; `conversation waiting`, `post failed`, `connection needs
  you`, `post held` → BADGE + DIGEST). A new delivery enqueues `notify.deliver(deliveryId)`;
  email keyed on the delivery id (the existing Resend idempotency rule).
- **D3 — Badge (R3).** The badge is the member's undismissed BADGE deliveries whose subject still
  needs them: each kind declares `stillOpen(facts)` answered by the owning domain's public surface in
  one batched call when the sheet opens; closed ones are marked `SUPERSEDED` (ux: items leave once
  fixed). Count is a partial-index count, read with the layout's existing data.
- **D4 — Digest (R4).** `notify.digest` runs daily at 09:00 IST, self-rescheduling with `startAfter`
  (no schedule slot): per member, open DIGEST deliveries grouped by kind; nothing open → no email.
  Off switch per member (`MemberNotificationPrefs`).
- **D5 — Channels are plugs (R6).** `ChannelPlug { key, deliver(delivery), status? }`: `email`,
  `badge` here; `whatsapp` registers in hub-marketing through campaigns' port; push later.
- **D6 — Parcel notices move (R8).** `notice.service.ts` emits through the hub with its existing
  kinds and templates; `Notice` rows migrate to `Delivery` in one migration with a backfill; the
  emails' words are unchanged (a snapshot test of every template before and after).
- **D7 — Retention (R7, Q7).** Deliveries and events after 13 months, by `social.retention`.

## Packages
None.

## UI approach
ux.md's bell and Needs you sheet in `PortalHeader` (sheet on a phone, popover from `lg:`), digest
email through `renderEmail`, Notifications settings page in Shop details. Words in
`notifications-copy.ts`.

## Gates touched
Routes bell list, dismiss, prefs; `MAY_USE_SHEET`; one repository each; email templates test.

## Data model
[MIGRATION] `NotificationEvent`, `Delivery`, `MemberNotificationPrefs`; backfill from `Notice`.

## API / contract changes
[CONTRACT] `emit` and the event shape (ADR-0069).

## Test plan
- Same event twice → one badge (A3); connection needs you → badge for every member (A1).
- Digest with two waiting conversations and a failed post; none → no email (A2).
- Post due → email at once (A4).
- Parcel notice word-for-word (A5).

## Delivery
1. **independent** (each emitting unit registers its own kind's `stillOpen`) — Events, deliveries, email plug, badge (behaviour).
2. **after U1** — Parcel notices moved (behaviour unchanged, proven by snapshot).
3. **after U1** — Digest, prefs, bell UI.

## Open questions
None.
