# TRD — contact-us

- **Status:** Implemented — PR-107
- **Domain:** support (new), with UI in the storefront and the admin portal
- **Phase:** —
- **Verified:** 2026-09-16
- **References:** [spec.md](spec.md), [ADR-0012](../../adr/0012-modules-are-vertical-slices-by-domain.md), [ADR-0013](../../adr/0013-one-error-envelope-and-useserverform.md), [ADR-0015](../../adr/0015-mobile-first-design.md), [ADR-0020](../../adr/0020-money-bearing-records-never-cascade.md), [ADR-0021](../../adr/0021-audit-trail-never-fails-the-action.md), [ADR-0022](../../adr/0022-design-decisions-go-through-tokens.md)

> Technical approach and decisions. No code — references to existing code only, to justify a decision.

## Approach

A new `server/support/` bounded context owning one aggregate, `ContactMessage`: one
repository, one service, one types module, per [ADR-0012](../../adr/0012-modules-are-vertical-slices-by-domain.md).
It is genuinely separate from `notifications`, which owns **outbound** transactional
email and knows nothing about inbound correspondence; folding an inbox into it would
give that domain a second reason to change.

Three routes: a public `POST /api/contact`, and the admin pair that lists and updates.
The storefront UI is one controlled bottom sheet with two steps — choose, then write —
reused by the account menu and the footer. WhatsApp needs no server at all: it is a
`wa.me` link built from one constant.

## Technical decisions

- **D1 — WhatsApp is a link, not an integration.** `wa.me/<number>?text=…` opens the app
  on a phone and WhatsApp Web on a desktop, with no account, no token and no API
  dependency. The Business API would let the store send first, which nothing here needs.
- **D2 — The number is a brand fact in `src/lib/config.ts`.** It is static, public and
  not environment-specific, which is exactly what that file is for; the URL builder
  lives beside it so no component concatenates a `wa.me` string. The stored form is
  E.164 digits without `+`, because that is what `wa.me` accepts in its path.
- **D3 — A signed-in sender's identity is re-read, never taken from the body.** The form
  posts name and email because the guest path needs them, and the route discards both
  when a session exists, reading the `User` row instead — the same reasoning as
  [ADR-0021](../../adr/0021-audit-trail-never-fails-the-action.md)'s rule about an admin
  id used as a foreign key. Invariant 4 is about the payload being untrusted, and a
  signed-in person's name is a server-owned field.
- **D4 — The sender's name and email are copied onto the row, and `userId` is nullable
  with `onDelete: SetNull`.** A message is correspondence, not money or attribution, so
  the cascade rule in [ADR-0020](../../adr/0020-money-bearing-records-never-cascade.md)
  does not reach it; `Review` already stores `userName` for the same reason, which is
  that deleting an account must not erase what the store was told.
- **D5 — Two states, `NEW` and `RESOLVED`, as a Prisma enum.** A closed set declared
  once, in the database, so nothing can write a third value. "Read" is not a state worth
  storing for one console: it would have to be written on every list render.
- **D6 — The flood guard counts recent rows, it does not rate-limit.** `src/lib/rate-limit/`
  allows everything until the cache is wired ([rate-limiting](../rate-limiting/)), so a
  limiter there would be decoration. The service refuses a submission when the same
  sender — `userId` when signed in, else the submitted email — already has three rows
  inside ten minutes. It is naive for a determined sender, who can change the email, and
  the route still calls `withRateLimit` so reconnecting the cache covers this path too.
- **D7 — Resolving is audited, submitting is not.** `recordAdminAction` after the commit,
  per [ADR-0021](../../adr/0021-audit-trail-never-fails-the-action.md): the trail records
  what an admin did, and a buyer sending a message is not an admin action.
- **D8 — One sheet, two mounts, controlled from outside.** The account menu owns the open
  state rather than the menu item, because the menu closes on an outside click and a
  sheet owned by an item inside it would unmount with its trigger.

## Packages

None. Radix's dialog primitive behind `src/components/ui/sheet.tsx`, `react-hook-form`
and `zod` are all already dependencies.

## UI approach

**Phone first (~360px).** The entry point is a full-width row above **Logout** in the
account menu. It opens the existing bottom sheet — which already caps its height,
scrolls its content and pads for the home indicator — carrying two stacked option rows,
each a 56px target with an icon, a label and a line of explanation. WhatsApp's brand
green comes from `SOCIAL_BRAND` in `src/lib/social-brand.ts`, the one file excused from
the token rule ([ADR-0022](../../adr/0022-design-decisions-go-through-tokens.md)).

Choosing **Message** replaces the options with the form in the same sheet, so nothing
navigates and a back gesture keeps the draft. Name and email are read-only for a
signed-in person, editable for a guest; the message field is a `Textarea` and keeps its
16px mobile base. Sending swaps the body for a confirmation with a Close button.

From `sm:` up the sheet is the same component — the option rows simply stop being the
full width of the screen. The footer gains a **Contact us** button, which is the
signed-out path and needs its own client leaf because the footer is server-rendered.

**Admin portal:** a `Contact` item in the sidebar and a page built from the existing
`DataTable` with a status filter, a search box, and a row action that toggles Resolved.

## Data model

**[MIGRATION]** `ContactMessage` — `id`, `userId?` (SetNull), `name`, `email`,
`subject?`, `message` (`@db.Text`), `status` (`ContactMessageStatus`, default `NEW`),
`createdAt`, `updatedAt`. Indexes on `(status, createdAt)` for the portal's default
view, and on `email` and `userId` for the flood guard. New enum
`ContactMessageStatus { NEW RESOLVED }`; `User` gains the back-relation.

## API / contract changes

None in [CONTRACTS.md](../../CONTRACTS.md). All three routes have exactly one consumer
each — the sheet and the admin page — which CONTRACTS.md says does not warrant an entry.
Failures go through `toErrorResponse` and the form reads them with `useServerForm`, so
the envelope is the existing one ([ADR-0013](../../adr/0013-one-error-envelope-and-useserverform.md)).

## Test plan

- `tests/unit/contact-message.test.ts` — the schema's bounds; the signed-in override of a
  spoofed name and email; the guest path keeping what it typed; the flood guard on its
  boundary; the status update recording an admin action.
- `tests/unit/contact-sheet.test.tsx` — both options present; the `wa.me` href carries
  the number and the encoded message; choosing Message shows the form, and a send shows
  the confirmation without navigating.
- `tests/unit/contact-whatsapp.test.ts` — the URL builder encodes and never emits a `+`.

## Delivery (PRs)

One PR. The schema, the domain, the routes, both entry points and the admin page are a
single demoable unit, and each half is inert without the other.

## Open questions

None. Reply-from-portal and email notification are named out of scope in the spec.
