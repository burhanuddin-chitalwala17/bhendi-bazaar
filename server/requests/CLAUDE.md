# CLAUDE.md — requests domain

- **Verified:** 2026-11-05
- **Covers:** `server/requests/**`

> Read the project-wide rules first: [`/CLAUDE.md`](../../CLAUDE.md). Requirements are in [docs/specs/setup-requests/](../../docs/specs/setup-requests/); every decision is in its `decisions.md`.

## Purpose
Tickets for what a shop cannot fix itself. A **requirement** is a known kind with a known solution the admin enables (one tap, or one decision); an **issue** is something only a developer can fix, written by the shop under a category (Q21).

## Boundaries
**Owns:** `Ticket` and `TicketNeed`. **Does not own:** the setup a requirement writes (listing's register and vocabulary, through `channel-setup.service`), the errors it hears (channels hands them over as the `requests.listing-complaints` job), or marketplace reads (`channel-types.service`, through the home brand's connection).

## Rules
- **A ticket is keyed by what fixes it, never by who hit it** (D3). A shop's need is a `TicketNeed`; a hundred shops are one ticket.
- **The line between the two sides is in the DTOs** (D11): an `AdminRequirementDTO` has no shop, product or words; a `ShopTicketDTO` has no plan or steps. Only an issue's view reads a need's shop and words (Q22). `tests/unit/setup-requests.test.ts`
- **Kinds are plug-ins** (`kinds/`, D4). The engine never branches on a kind; a new kind is a file and a line in `kinds/index.ts`.
- **Raising is two statements however many shops** (D3, D5): `ticketRepository.raise` upserts every ticket, then every need. A done ticket that is raised again reopens (Q12).
- **Apply recomputes the plan and compares its hash** (D7), then writes the setup and resolves the ticket in one transaction, only while open (D8).
- **Done is checked, not claimed** (D9): the daily job closes any requirement whose setup now exists, however it was made.
- **Nothing here stops a listing** (ADR-0053): a failed hand-over is logged, never thrown into a send.

## Structure
| Path | Holds |
|---|---|
| `request.service.ts`, `request.types.ts` | The public surface: raise, report, the shop's view, the inbox, plan, apply, not now, mark fixed, the daily check |
| `ticket.repository.ts` | The one writer of `Ticket` and `TicketNeed` |
| `complaint-sort.ts` | Which complaints are ours to fix, as needs; pure |
| `kinds/` | One plug-in per kind; `field-match.ts` matches a marketplace field to our vocabulary, pure |
| `home-brand.ts` | `HOME_BRAND_ORG_ID`, read here only |
| `requests.job.ts`, `requests.jobs.ts` | Job specs and their handlers (complaints in, resolved out, the daily check) |
