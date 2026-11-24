# Decisions — picker-filters

- **Verified:** 2026-11-24

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones (ADR-0062).
> Owner decides money, policy, irreversible data, external commitments, taste.
> Claude decides the rest, marked `Claude · reversible`. Other documents cite Q ids.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | Which filters does the picker get? | Tag, Usage, Source, Date range | Owner | 2026-11-24 | Owner chose all four | decided |
| Q2 | Do picker filters live in the URL? | No — in the picker's own state, kept while the page is open, reset on reload | Claude · reversible | 2026-11-24 | The picker opens over other pages whose URL it must not change | decided |
| Q3 | Does the picker get "Show retired"? | No | Claude · reversible | 2026-11-24 | A retired picture cannot be placed anywhere, so offering it is a dead end | decided |
| Q4 | Search by product name in the picker? | Not in this feature | Claude · reversible | 2026-11-24 | Not asked for; the Library page has no such filter either | parked |
| Q5 | On a phone, are the four filters always visible? | Behind one "Filters" button showing the count in force; inline from `md` | Claude · reversible | 2026-11-24 | Four selects push the grid below the fold of a phone dialog | decided |
| Q6 | A tag chosen on Photos, then the Videos tab opened? | Ignored on tabs whose items take no tags, not counted on the button, kept for Photos | Claude · reversible | 2026-11-24 | Switching tabs should not silently empty the grid | decided |

## Parked (Later)
- Q4 — search by product name; BACKLOG Phase 11.
