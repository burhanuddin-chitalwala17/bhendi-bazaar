# Decisions — social-selling/whatsapp-campaigns

- **Verified:** 2026-11-22

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented
> ones
> ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste. Claude decides the
> rest, marked `Claude · reversible`. Ids here are this subfeature's own; "parent Qn" means
> [../decisions.md](../decisions.md). Binding here from the parent: Q5, Q7, Q8, Q9, Q27, Q37, Q40,
> Q47, Q54, Q66, Q75.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | What is a campaign? | One approved template (whatsapp-sending), its placeholders filled, optionally carrying one product or up to 30 in a multi-product message, sent to one named list at a time the shop picks or now | Claude · reversible | 2026-11-06 | Product messages fold in here (parent Q107); one list per campaign keeps counts and cost exact | decided |
| Q3 | What does the review show, and what if the numbers change by send time? | Who will get it, who is skipped and why (not opted in, stopped, capped), the template's category and price per message, and the estimated total in rupees; the shop confirms. A scheduled campaign recounts at send and goes to whoever qualifies then, never to more people than the shop confirmed | Claude · reversible | 2026-11-06 | The shop sees the cost before a send (parent Q8) | decided |
| Q13 | When does a campaign go, and can it be changed? | At the minute the shop picked, IST, any time of day (parent Q40). A campaign due during an outage goes when the worker resumes, unless more than 6 hours late, when it is held for the shop to send or cancel. It can be edited or cancelled until it starts sending, then only stopped, and those not yet sent are not charged | Claude · reversible | 2026-11-06 | The shop stays in control | decided |
| Q14 | What does a campaign report, including failures? | Sent, delivered, read, failed and skipped, each with reasons, the actual cost, and buttons tapped where the template has them. Failures are recorded per recipient with Meta's error codes in plain words (not on WhatsApp, blocked, Meta limit) and retried only when temporary, three times; the port answers its caller so the hub can fall back to email (parent Q61, Q66) | Claude · reversible | 2026-11-06 | What Meta's status webhook gives | decided |

## Parked (Later)
None. A/B tests, recurring campaigns and click attribution to orders are not asked for by any
acceptance here; raise them as new questions if wanted.

## Merged ids
Absorbed in the 2026-11-21 audit; read the id on the right.
Q2 → parent Q9 · Q4 → Q3 · Q6 → Q5 · Q7 → parent Q8 · Q9 → Q8 · Q10 → Q8 · Q11 → Q14 · Q12 → Q13 · Q15 → parent Q75 · Q16 → parent Q47 · Q17 → parent Q37 · Q18 → Q8 · Q19 → parent Q8 · Q5 → whatsapp-sending Q11 · Q8 → whatsapp-sending Q12 · Q20 → whatsapp-sending Q13 (moved 2026-11-22)
