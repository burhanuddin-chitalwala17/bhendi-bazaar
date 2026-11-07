# CLAUDE.md — requests domain

- **Verified:** 2026-11-06
- **Covers:** `server/requests/**`

> Read the project-wide rules first: [`/CLAUDE.md`](../../CLAUDE.md). Requirements are in [docs/specs/setup-requests/](../../docs/specs/setup-requests/); every decision is in its `decisions.md`.

## Purpose
Tickets for what a shop cannot fix itself. A **requirement** is a known kind with a known solution the admin enables (one tap, or one decision); an **issue** is something only a developer can fix, written by the shop under a category (Q21).

## Boundaries
**Owns:** `Ticket` and `TicketNeed`, and an engine that knows no module. **Does not own:** what any kind is about. Marketplace tickets live in the `marketplace/` plug-in, the only part that reads channels or the channel register; channels hands refusals over as the `requests.listing-complaints` job and never imports this domain.

## Rules
- **A ticket is keyed by what fixes it, never by who hit it** (D3). A shop's need is a `TicketNeed`; a hundred shops are one ticket.
- **The line between the two sides is in the DTOs** (D11): an `AdminRequirementDTO` has no shop, product or words; a `ShopTicketDTO` has no plan or steps. Only an issue's view reads a need's shop and words (Q22). `tests/unit/setup-requests.test.ts`
- **The engine knows no module** (D4, Q33). `request.service`, `request.types`, `ticket.repository`, the jobs and `kinds/kind.ts` import no channel or listing code and name no marketplace or kind; a kind brings its own subject, plan and choice shapes and parses its own choice. `tests/unit/requests-decoupled.test.ts`
- **A module plugs in with a folder and a registry line**: its `TicketKindPlugin`s (fingerprint, words, plan, apply, done check) and a `NeedSource` (needs from its events, and from a daily standing check) in `kinds/index.ts`; its preview component in `src/components/requests/requirement-plans.tsx`. The marketplace plug-in is the worked example.
- **Raising is two statements however many shops** (D3, D5): `ticketRepository.raise` upserts every ticket, then every need. A done ticket that is raised again reopens (Q12).
- **Apply recomputes the plan and compares its hash** (D7), then writes the setup and resolves the ticket in one transaction, only while open (D8).
- **Done is checked, not claimed** (D9): the daily job closes any requirement whose setup now exists, however it was made.
- **Nothing here stops a listing** (ADR-0053): a failed hand-over is logged, never thrown into a send.

## Structure
| Path | Holds |
|---|---|
| `request.service.ts`, `request.types.ts` | The engine and its neutral words: raise, raise from events, report, the shop's view, the inbox, plan, apply, not now, mark fixed, the daily pass |
| `ticket.repository.ts` | The one writer of `Ticket` and `TicketNeed` |
| `kinds/` | The plug-in contract (`kind.ts`), the registry (`index.ts`) and the one built-in kind, `issue.kind.ts` |
| `marketplace/` | The marketplace plug-in: its two kinds, its types, `complaint-sort.ts` and `field-match.ts` (pure); `HOME_BRAND_ORG_ID` is read by `server/shared/home-brand.ts` |
| `requests.job.ts`, `requests.jobs.ts` | Job specs and their handlers (events in, resolved out, the daily pass) |
