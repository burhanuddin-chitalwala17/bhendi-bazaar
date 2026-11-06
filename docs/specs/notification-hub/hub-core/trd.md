# TRD — notification-hub/hub-core

- **Status:** Draft
- **Domain:** notifications
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [spec.md](spec.md), [ux.md](ux.md) (Draft), [decisions.md](decisions.md), [ADR-0069](../../../adr/0069-notifications-are-one-hub-every-module-plugs-into.md), [ADR-0038](../../../adr/0038-background-work-runs-on-an-owned-worker-against-a-postgres-job-queue.md), [ADR-0033](../../../adr/0033-a-domain-is-reached-through-its-public-surface.md), [server/notifications/CLAUDE.md](../../../../server/notifications/CLAUDE.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach
`server/notifications/` gains a hub: `notify.service.emit(tx, event)` is the only entry. It
resolves recipients, applies the shop's switches, window and global cap, picks a channel and writes
one `Delivery` row per recipient and channel on the caller's transaction; a new row enqueues
`notify.deliver`. The worker hands the row to its channel plug and records the outcome. Shop events
also update a per-member unread projection. A daily job builds the digest from what is still open.
The existing `Notice` path keeps working until order-updates moves it (hub Q5).

## Prior art
- **Notification hubs** (Novu, Knock, Courier, all documented): a *workflow* triggered by an
  event, *channels* as providers, per-subscriber *preferences*, and a *digest* step. We follow the
  shape (event → policy → channel) and the digest, not the vendor (ADR-0069 alternatives).
- **Transactional outbox** (Richardson, *Microservices Patterns*): write the intent in the
  business transaction, deliver after commit. Our `Notice` already does this; `Delivery` generalises it.
- **List-Unsubscribe** (RFC 8058) one-click header alongside the visible link; Gmail and Yahoo have
  required it for bulk senders since 2024. We follow it.

## Technical decisions
- **D1 — One entry, `emit`.** Event: `kind` (closed set `NOTIFY_KIND`), `audience`, `orgId`,
  recipient ref (user id, or a contact id from social-selling's audience), `key` (idempotency, e.g.
  `conversation:<id>:waiting`), `facts` (ids only). Zod-parsed at the boundary. Modules call it
  through the public surface; they never import a channel (boundary test rule, A7). Modules that
  keep notifications out of their imports enqueue a shared job hub-core handles by calling `emit`:
  `social.post-failed`, `social.post-due` (post-scheduling D8, whatsapp-status-kit D3) and
  `channels.needs-reconnect` (connect-instagram D6, connect-whatsapp D8). Inbox (inbox-core D6) and
  automations (comment-automations D11) call `emit` directly.
- **D2 — `Delivery` row, unique (key, recipientRef, channel).** Stores kind, audience, orgId,
  channel, status (`PENDING`, `SENT`, `DELIVERED`, `FAILED`, `SKIPPED`), skip reason, attempts,
  timestamps. No body (Q7). `createMany … skipDuplicates`; only inserted rows enqueue.
- **D3 — `NotifyChannel` port**: `canReach(recipient, kind)` (consent and channel cap, answered by
  the channel), `deliver(row)`, `status(row)`. Plugs: `email` (wraps `EmailService`), `badge`
  (writes the projection), `whatsapp`: `canReach` → campaigns' `whatsAppCanSend`, `deliver` →
  `deliverByWhatsApp` keyed on the row id, `status` from its outcome (whatsapp-campaigns D2, D9;
  social-selling subfeature 13). Until it exists the plug answers "cannot reach" and email takes over.
- **D4 — Channel order for marketing**: WhatsApp, then email (social-selling Q73). The hub asks
  `canReach` in order and writes a row for the first that says yes. A lasting WhatsApp failure
  marks the row `FAILED` and writes the email row (R10). Shop and transactional kinds name their
  channels in `NOTIFY_ROUTES`, declared once.
- **D5 — Global cap** read at emit: today's (IST, `server/shared/india-time.ts`) marketing count for
  (org, recipient) — `SENT`/`PENDING` non-WhatsApp `Delivery` rows plus campaigns' `whatsAppCounts`,
  which also counts campaigns the hub never saw (social-selling Q68, Q74) — against
  `OrgNotifySettings.dailyCap` (default 3). Over it → `SKIPPED` with `cap_reached`. The same check is
  hub-core's implementation of campaigns' `GlobalCapPort`, registered at start-up, so a campaign obeys
  it too. Unlocked: a race passes by one (ADR-0069).
- **D6 — Unread projection** `NotifyUnread` (org, member, kind, ref, openedAt, clearedAt): a shop
  event inserts; the source module emits a matching `…_resolved` event (answered, republished,
  reconnected) which clears it. Home's badge is a count of uncleared rows, read with the portal
  layout; the Inbox item's count is inbox's public `unreadCount(shop)` (inbox-core D11, Q11).
- **D7 — Digest**: a scheduled `notify.digest` at 09:00 IST reads uncleared rows older than their
  kind's threshold (4 hours for conversations, at once for the others) per member with the email on,
  and sends one email through the layout's blocks. Read at send time, so answered items are gone.
- **D8 — Unsubscribe**: each marketing email carries audience's signed link (audience D8,
  `unsubscribeLink(sender, channel, contact)`) visibly and as the RFC 8058 header. The route
  `GET /api/audience/unsubscribe/[token]` and its stop are audience's; the page it shows is this ux.md's.
  Edited → "This link doesn't work"; nothing withdrawn.
- **D9 — Retention**: a monthly job deletes `Delivery` rows older than 13 months (Q7).

## Packages
None.

## UI approach
Cite [ux.md](ux.md) for screens, states and copy.
- **Per form factor:** Notifications settings is one column on the phone (cap stepper, member
  email switch, connected channels list); `md:` and `lg:` keep one column at the portal's form width.
  The badge is a count chip on the menu item for the inbox and on Home.
- **Rendering:** the settings page is a server component reading `notifySettingsService.forOrg`;
  the cap stepper and email switch are the client leaves.
- **Behaviour:** `notifyApiClient.ts` (`saveCap`, `setDigest`) with `useMutation`; the page gets a
  `NotifySettingsDto`.
- **Surfaces:** existing `ui/` switch, input and card; no sheet; no new token.

## Gates touched
- New route `/api/org/[orgId]/notifications` → route-reachability, portal-boundary, request-body-parsing.
- New tables written only by `delivery.repository.ts`, `notify-settings.repository.ts`,
  `notify-unread.repository.ts` → one-repository.
- module-boundaries: a rule that the hub's channel plugs are imported by no other domain.
- Copy in `notify-copy.ts`; links via `ROUTES` (ADR-0067).

## Data model
[MIGRATION] `Delivery`, `OrgNotifySettings` (orgId unique, dailyCap Int default 3),
`MemberNotifySettings` (member, digestEmail Bool default true), `NotifyUnread`. No change to `Notice`.

## API / contract changes
CONTRACTS.md gains the `NotifyEvent` shape (what modules emit) and `NotifySettingsDto`. [CONTRACT]

## Test plan
- Unit: route choice (D4) and cap counting across IST midnight (D5); token verify (D8).
- Integration (test DB): replayed emit → one row (A2); fourth marketing emit → `SKIPPED` (A3);
  WhatsApp-cannot-reach → email row (A4); digest omits a cleared item (A1).
- Boundary test for A7, mutation-tested by adding a stray import.

## Delivery (PRs)
1. Tables, `emit`, `Delivery`, email plug, boundary rule (no behaviour change yet).
2. Badge projection; handlers for `social.post-failed`, `social.post-due`, `channels.needs-reconnect` (changes behaviour: badge appears).
3. Digest job and member switch.
4. Global cap (and its `GlobalCapPort` registration for campaigns), marketing route order, unsubscribe route and settings page.
5. WhatsApp plug, once social-selling's send port exists.

## Open questions
None.
