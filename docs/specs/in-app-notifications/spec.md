# Spec — in-app-notifications

- **Summary:** Signed-in users receive real-time and polled in-app alerts with unread badge counter and drawer/popover panel
- **Status:** ✅ Implemented — PR-159
- **Domain:** notifications, cross-domain
- **Phase:** 5 — Scale & operability
- **Verified:** 2026-09-25
- **References:** [trd.md](trd.md), [ADR-0015](../../adr/0015-mobile-first-design.md), [ADR-0016](../../adr/0016-mobile-app-shell.md)

> Requirements and product approach only. Technical approach lives in [trd.md](trd.md).

## What this feature is

An in-app notification system that alerts signed-in users (shoppers, sellers, admins) about activity in their account — order status changes, outbid alerts, price drops, promotional offers, and system announcements — directly within the store header and mobile shell.

## Why

Transactional email is asynchronous, delayed, and often missed or caught in spam filters. In-app notifications deliver immediate, high-visibility feedback right inside the app interface when users are browsing, bidding, or managing orders.

## Requirements

### Notification Delivery & Access

- **R1** — Signed-in users see an in-app notification indicator (bell icon) in the header navigation chrome across storefront, seller portal, and admin views.
- **R2** — When unread notifications exist, the bell displays a visual badge with the count of unread items.
- **R3** — Tapping or clicking the bell icon opens a notification panel (a mobile drawer/bottom sheet on phone viewports or a popover on desktop).
- **R4** — Each notification item displays a title, body message, time elapsed, category/type (e.g. `ORDER_UPDATE`, `BID_OUTBID`, `PROMOTION`, `SYSTEM`), and an optional destination link.
- **R5** — Each notification has a **View** action that opens it in a dialog showing its full title, message, type and time. Viewing marks it read. A notification with a link offers **Open** in that dialog, which navigates to the page (e.g. order detail, active bidding event); a link that would leave the site is not offered.
- **R6** — Users can explicitly mark individual notifications as read or use a "Mark all as read" action.
- **R7** — The panel has two views. **Inbox** lists unread notifications, newest first. **History** lists every notification the user has marked read, most recently read first, paged with **Load more**. A notification is in exactly one of them.
- **R8** — Notifications are strictly scoped to the authenticated user and cannot be accessed or modified by any other account.
- **R9** — Unread count updates automatically in the background using periodic polling or page focus revalidation.

## Product acceptance

- **A1** — On a ~360px mobile screen, tapping the bell icon smoothly opens a bottom drawer displaying notifications with proper line wrapping and no horizontal clipping.
- **A2** — When a new notification arrives for a user, the unread badge increments and opening the panel displays the new notification at the top.
- **A3** — Tapping **View** opens the notification in a dialog, marks it read, moves it from Inbox to History, and decrements the unread badge; **Open** in the dialog navigates to its linked page.
- **A5** — A notification marked read (singly, by viewing, or by "Mark all as read") appears in History with when it was read, and no longer appears in Inbox.
- **A4** — Tapping "Mark all as read" immediately clears the unread badge counter and updates all listed items to read status.

## Out of scope (this feature)

- Web Push / Browser Push Notifications (FCM / Service Workers) — deferred.
- Per-category notification preference matrix (email vs in-app toggles) — deferred to account settings feature.
