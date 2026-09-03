# notifications — domain rules

Transactional email. One provider (Resend, in `email.service.ts`), one shell, four templates.

## Every email renders through `renderEmail`

`templates/layout.ts` owns the whole document — doctype, head, stylesheet, accent bars,
header, optional banner, footer. A template supplies **only what differs**: title, tagline,
body, and any CSS the shared sheet does not already carry.

A template that writes its own `<!DOCTYPE>`, `<head>`, header or footer is a defect — that
is exactly the duplication this file exists to prevent, and it is how four emails came to
carry four copies of the same footer. `tests/unit/email-templates.test.ts` fails a second
`email-wrapper` in one document.

**Adding an email:** a new file in `templates/`, returning `renderEmail({...})`, plus a
`send*` method on `EmailService`. Compose the body from the layout's blocks — `greeting`,
`paragraph`, `closingNote`, `button`, `noticeBox`, `alternateLink`, `detailPanel` — and add
a block there rather than a second hand-rolled copy of one.

## Interpolated data is escaped

Names, addresses, order notes and product titles are typed by people, so every one of them
goes through `esc()` (Invariant 4's reasoning, applied to output). `paragraph` and the other
block helpers take *markup* and do not escape it — escape the values you interpolate into it.
`greeting` and `renderEmail`'s own fields escape for you.

## Money

Templates format with `formatPaise` from `formatters.ts` — integer paise in, rupees out
([ADR-0004](../../docs/adr/0004-money-as-integer-paise.md)). This module is the documented
exception to "server code never formats money": an email has no client to format it.

## Brand facts are declared here, not imported

`BRAND_NAME` / `BRAND_TAGLINE` live in `layout.ts` because `server/` must not import from
`src/`. Absolute links come from `appUrl()`, never a hardcoded origin.

Verified: 2026-09-03
