# Decisions — social-selling/whatsapp-sending

- **Verified:** 2026-11-21

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented
> ones
> ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste. Claude decides the
> rest, marked `Claude · reversible`. Ids here are this subfeature's own; "parent Qn" means
> [../decisions.md](../decisions.md). Binding here from the parent: Q5, Q7, Q8, Q9, Q37.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q3 | What is the starter set's wording, script and submission? | The wording is ux.md's copy deck; the Hindi, in Devanagari, is read by a native reader before it goes to Meta. The set is submitted as a background job once WhatsApp connects, and a reconnect submits only what is missing or deleted | Owner | 2026-11-06 | Owner approved the English; Hindi checked first | decided |
| Q5 | What may a shop's own template be? | A category (marketing or utility, picked by the shop with a one-line explanation of each, though Meta may re-categorise on review and we show Meta's answer and its price), a language (English or Hindi), a header (none, text or a library image), a body with up to three placeholders from a closed list (buyer's first name, shop name, product name, product price, product link), an optional footer and up to two buttons (visit link, quick reply); every marketing template gets a STOP line. A starter template is never edited in place: the shop copies it into its own, which goes to Meta as a new template, so starter wording stays ours to fix for everyone. No cap of ours on how many; Meta's limit applies and is explained when reached | Claude · reversible | 2026-11-06 | Covers what a shop needs while staying inside Meta's template rules; closed placeholders mean we always know what fills them | decided |
| Q7 | What states does a template have, and what follows from them? | In review, Approved, Rejected (Meta's reason, cut to 300 characters, and what to change), Paused (low quality, with when it resumes) and Disabled, kept in step by Meta's template-status webhook with a daily look as backstop. A scheduled campaign whose template is paused or rejected does not send: it shows Held with the reason, nothing is charged, and the shop picks another approved template or waits. Deleting archives the template here and deletes it at Meta; one used by a sent campaign stays readable in that campaign's history | Claude · reversible | 2026-11-06 | Mirrors marketplace issues (marketplace-publish Q6); webhooks can be missed | decided |
| Q10 | How is a template's price known and shown? | Beside each template and on the campaign review: its category's price per delivered message in India, from one dated rate table in code, in paise, with its source and checked date. The table changes in code when Meta changes its rates, and the owner is told on the day Meta announces a change | Claude · reversible | 2026-11-06 | The shop sees cost before a send (parent Q8); rates change, so they carry a date | decided |

## Parked (Later)
None. Template analytics (read and click rates) belong with campaign reports, not here.

## Merged ids
Absorbed in the 2026-11-21 audit; read the id on the right.
Q1 → parent Q37 · Q2 → Q3 · Q4 → Q5 · Q6 → Q5 · Q8 → Q7 · Q9 → Q7 · Q11 → Q10 · Q12 → Q3 · Q13 → Q5
