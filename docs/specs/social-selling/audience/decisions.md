# Decisions — social-selling/audience

- **Verified:** 2026-11-22

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented
> ones
> ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste. Claude decides the
> rest, marked `Claude · reversible`. Ids here are this subfeature's own; "parent Qn" means
> [../decisions.md](../decisions.md). Binding here from the parent: Q7, Q9, Q27, Q34, Q37, Q40, Q66,
> Q75.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q8 | What is the checkout box, and when does it record consent? | One box, unticked by default, naming both consents explicitly: "I agree to get offers from <shop names> and, separately, from Bhendi Bazaar, on WhatsApp and email. I can stop either any time." Replaced in place 2026-11-23 (owner: keep one box, say both consents outright). was: "Send me offers from <shop names> and Bhendi Bazaar on WhatsApp and email. Stop any time." Guests get it too, their phone and email being on the order. Consent is recorded at payment confirmed, so an abandoned checkout records nothing, and goes to every shop in the order plus the platform, each on WhatsApp and email | Owner | 2026-11-06 | Names both senders and both channels (parent Q27) | decided |
| Q10 | How does the store page's opt-in work? | Shown only on a shop whose WhatsApp is connected, in the storefront's header and footer. "Get offers on WhatsApp" opens `wa.me/<shop number>` with "YES <shop code>" pre-filled; any inbound message to that number whose text, trimmed and case-folded, is YES, HAAN or हाँ (with or without the code) opts the sender in, the message id being the evidence. It opts in to that shop on WhatsApp only: the checkout box is the one place both senders and both channels are named | Claude · reversible | 2026-11-06 | The number already identifies the shop; the code only helps if a shop shares a number later. Hindi words honour parent Q37 | decided |
| Q15 | What does an upload accept? | CSV or XLSX, up to 5,000 rows: phone (required), name and email (optional). Invalid phones are skipped and counted; duplicates merge into one contact. The attestation tick (parent Q9) is required to make them Opted in; without it they arrive as Not yet | Claude · reversible | 2026-11-06 | Bulk-sheet's file handling exists; 5,000 is above any shop we have, and a bigger file is a split, not a gate | decided |
| Q17 | Which list filters exist (parent Q75)? | Opted in on WhatsApp (always applied), bought from a category, wishlisted any of the shop's products, last order within N days, and member of an uploaded list. Filters combine with AND. A list is a saved filter, counted live, never a stored copy of members | Claude · reversible | 2026-11-06 | A saved filter cannot hold a contact who has since stopped | decided |
| Q19 | Who sees a contact's details? | Members of that shop, on the Audience page, with the phone masked to its last four digits; the full number shows on tap and the view is audit-logged. Contacts cannot be exported | Claude · reversible | 2026-11-06 | The shop needs to recognise people; the mask stops shoulder-surfing and bulk copying | decided |
| Q20 | How does a shop send its first offer to synced contacts? | From the Audience page: "Send a first offer to your 312 phone contacts", using the starter first-offer template (or the shop's copy of it) with a product, the cost shown before Send, sent up to 100 a day; results counted as said yes, said stop, no answer (consent-core Q11) | Owner | 2026-11-23 | Turns the phone book into an honest list in one go | decided |

## Parked (Later)
- Q19 — contact export; would need its own consent and audit decision.

## Merged ids
Absorbed in the 2026-11-21 audit; read the id on the right.
Q2 → Q3 · Q4 → Q3 · Q6 → Q8 · Q7 → Q8 · Q9 → Q8 · Q11 → Q10 · Q12 → Q10 · Q14 → Q13 · Q16 → parent Q37 · Q18 → Q5 · Q20 → Q19 · Q22 → Q21 · Q23 → Q5 · Q24 → Q1 · Q1 → consent-core Q6 · Q3 → consent-core Q7 · Q5 → consent-core Q8 · Q13 → consent-core Q9 · Q21 → consent-core Q10 (moved 2026-11-22)
