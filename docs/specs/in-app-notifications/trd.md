# TRD — in-app-notifications

- **Status:** ✅ Implemented — PR-147
- **Domain:** notifications, cross-domain
- **Phase:** 5 — Scale & operability
- **Verified:** 2026-09-24
- **References:** [spec.md](spec.md), [ADR-0003](../../adr/0003-one-repository-per-aggregate.md), [ADR-0012](../../adr/0012-modules-are-vertical-slices-by-domain.md), [ADR-0013](../../adr/0013-one-error-envelope-and-useserverform.md), [ADR-0015](../../adr/0015-mobile-first-design.md), [ADR-0016](../../adr/0016-mobile-app-shell.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach

Extend the existing `server/notifications/` domain ([ADR-0012](../../adr/0012-modules-are-vertical-slices-by-domain.md)) to handle in-app notification persistence and queries alongside transactional email.

In-app notifications are stored in a new Prisma model `InAppNotification` linked to `User`. Data reads and writes are isolated within `server/notifications/in-app.repository.ts` ([ADR-0003](../../adr/0003-one-repository-per-aggregate.md)). The frontend fetches notifications and unread count through authenticated Next.js route handlers using background polling or SWR refetching.

## Technical decisions

- **D1 — Data Model.** New Prisma model `InAppNotification` (`id`, `userId`, `title`, `message`, `type`, `link`, `isRead`, `readAt`, `createdAt`). Enum `NotificationType` (`ORDER_UPDATE`, `BID_OUTBID`, `PROMOTION`, `SYSTEM`).
- **D2 — Database Indexes.** Compound index `@@index([userId, isRead, createdAt])` to ensure `count({ where: { userId, isRead: false } })` and paginated list queries remain sub-millisecond.
- **D3 — Repository & Service Layer.** `server/notifications/in-app.repository.ts` and `server/notifications/in-app.service.ts`. All database queries are scoped to `userId`.
- **D4 — Route Handlers.** `/api/notifications` (`GET` for listing & unread count, `POST` for internal creation) and `/api/notifications/read` (`PATCH`/`POST` to mark item or all as read). Inputs parsed with Zod schemas in `src/lib/validation/schemas/notifications.ts` ([ADR-0013](../../adr/0013-one-error-envelope-and-useserverform.md)).
- **D5 — Authentication & Authorization.** `getServerSession` enforces user identity on route handlers. A user can only fetch, read, or update their own notifications.
- **D6 — Client Polling Strategy.** Mobile and desktop UI header components poll `/api/notifications` periodically (e.g. 30 seconds) and on window focus. Avoids WebSocket complexity and stateful server memory overhead.

## Packages

None. Uses standard React, Lucide icons, and existing Tailwind/Shadcn UI primitives.

## UI approach

Mobile-first ([ADR-0015](../../adr/0015-mobile-first-design.md), [ADR-0016](../../adr/0016-mobile-app-shell.md)).
- **Header Bell Component (`NotificationBell`):** Sits in top header. Displays a red badge with unread count when `unreadCount > 0`.
- **Mobile (~360px):** Clicking the bell opens a bottom drawer / sheet slide-up listing recent notifications with touch targets ≥40px.
- **Desktop (`md:` breakpoint):** Displays as a dropdown popover anchored below the bell icon.

## Data model

`[MIGRATION]`. Adds `InAppNotification` model and `NotificationType` enum to `prisma/schema.prisma`.

## API / contract changes

Adds endpoints:
- `GET /api/notifications` (Response: `{ notifications: InAppNotificationDTO[], unreadCount: number, hasMore: boolean }`)
- `POST /api/notifications` (Internal/Server creation)
- `PATCH /api/notifications/read` (Payload: `{ notificationId?: string, markAll?: boolean }`)

## Test plan

Per [TESTING.md](../../TESTING.md).
- **Unit Tests:** `tests/unit/in-app-notification.test.ts` testing repository & service operations (creation, fetching per user, unread count logic, marking single or all as read).
- **Security Tests:** Verify a user cannot query or mark another user's notifications.

## Delivery (PRs)

1. Schema migration, `InAppNotification` model, domain repository & service logic, unit tests.
2. Validation schemas and Next.js route handlers (`/api/notifications`, `/api/notifications/read`).
3. UI components (`NotificationBell`, `NotificationPanel`) integrated into the global navigation header.
