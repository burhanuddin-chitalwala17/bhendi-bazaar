# Decisions — navigation-flows

- **Verified:** 2026-11-10

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones (ADR-0062).
> Owner decides money, policy, irreversible data, external commitments, taste.
> Claude decides the rest, marked `Claude · reversible`. Other documents cite Q ids.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | When one feature opens another (Review and publish → Add barcode → product), where do save and cancel go? | Back one step, to the screen that opened it | Owner | 2026-11-10 | The person finishes what they started; each step unwinds in order | decided |
| Q2 | Where does a finished feature land? | Back where it started, with a toast saying what happened | Owner | 2026-11-10 | The person carries on with the list they were working through | decided |
| Q3 | Leaving halfway with unsaved changes? | Ask "Leave without saving?" (Stay / Leave); with nothing changed, leave at once | Owner | 2026-11-10 | Work is never lost by accident, and a clean form never nags | decided |
| Q4 | How wide is the first pass? | Seller portal, admin and the shopper store together | Owner | 2026-11-10 | One rule, applied once, reviewed once | decided |
| Q5 | Do the header Back and a form's Cancel go to the same place? | Yes, always: both are the early exit (R3) | Claude · reversible | 2026-11-10 | Admin category and product-type forms send them to different places today | decided |
| Q6 | A screen opened with no known start (a bookmark, a shared link, a new tab)? | Back goes to the screen's natural parent: product → Products, order → Orders, listing → the marketplace's Listings | Claude · reversible | 2026-11-10 | There must always be a way back; the browser's own history may lead out of the app | decided |
| Q7 | Does "the start" include its filters, search, tab and page? | Yes: a list is returned to exactly as it was left | Claude · reversible | 2026-11-10 | A filtered list that comes back unfiltered is a different start; every audit found this | decided |
| Q8 | Edit screens that today stay put on save (Edit product, Edit offer, settings opened from elsewhere) — stay or return? | Open | Owner | — | Taste: staying lets a seller keep editing; returning matches Q2. Recommendation: return when opened from another screen, stay when reached from the menu | open |
| Q9 | New product ends on a screen offering Share, Add another and View product. Keep it? | Open | Owner | — | Taste. Recommendation: keep it, and make its first button "Back to {start}" | open |
| Q10 | Sign out on a public page (a product, a shop) — where to? | Stay on that page; from an account or portal page, go to the store's home | Claude · reversible | 2026-11-10 | The page is still valid signed out; the account page is not | decided |
| Q11 | Does "Leave without saving?" cover dialogs and sheets as well as pages? | Yes: closing a dialog that holds typed input asks too | Claude · reversible | 2026-11-10 | Admin's org dialog and shipping credentials are lost on an outside click today | decided |
| Q12 | A start address arriving in the link — trusted? | Only our own paths; anything else falls back to Q6 | Claude · reversible | 2026-11-10 | A crafted link must never send someone off the site (the sign-in pages already hold this rule) | decided |
| Q13 | Buyer returns and refunds (no flow exists) | Later | Claude · reversible | 2026-11-10 | A new capability, not navigation; BACKLOG row | parked |
| Q14 | Read and stock-sync wording for sellers (proposed earlier in this conversation) | Later, as its own feature, awaiting the owner's go-ahead | Claude · reversible | 2026-11-10 | A different outcome: what a screen says, not where it leads | parked |

## Parked (Later)
- Q13 — buyer returns and refunds: BACKLOG, Phase 13 table, beside this feature.
- Q14 — marketplace read and sync wording: BACKLOG, Phase 13 table, beside this feature.

## Fixes found by the audit, outside this spec (fixes skip ceremony)
- Editing a saved address on the profile adds a second address instead of changing it.
- Signing in from checkout throws away the guest address already typed.
- Adding an address in checkout closes the dialog even when saving failed.
