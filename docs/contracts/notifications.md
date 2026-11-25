# Contracts — notifications

- **Verified:** 2026-11-25
- **Covers:** `server/notifications/notification.types.ts`

The hub's one inbound shape ([ADR-0069](../adr/0069-notifications-are-one-hub-every-module-plugs-into.md),
notification-hub/notifications-core D1). It crosses domains on the server, not the wire; rules are in
[CONTRACTS.md](../CONTRACTS.md).

**An event** — `notificationsService.emit(tx, input)`, parsed by `emitInput`. `kind` is one of
`NOTIFICATION_KIND`; `audience` is `SHOP_MEMBERS` (every member of `orgId`) or `BUYER` (then `recipientRef`
names them); `eventKey` is unique per real happening, so emitting it again is the same event and tells nobody
twice; `facts` maps a short name to an id or key (no spaces, at most 64 characters), never a message body. The
emitter never names a channel: `policy.ts` decides. Called inside the emitter's transaction, so the event and
its deliveries commit or roll back with the business row.

**Still open** — `notificationsService.registerStillOpen(kind, check)`: the kind's owner answers, for a batch of
facts, which items still need the shop; the rest leave the Needs you list.
