# Decisions — social-selling/whatsapp-campaigns

- **Verified:** 2026-11-21

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented
> ones
> ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste. Claude decides the
> rest, marked `Claude · reversible`. Ids here are this subfeature's own; "parent Qn" means
> [../decisions.md](../decisions.md). Binding here from the parent: Q5, Q7, Q8, Q9, Q27, Q37, Q40,
> Q47, Q54, Q66, Q75.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | What is a campaign? | One approved template (whatsapp-templates), its placeholders filled, optionally carrying one product or up to 30 in a multi-product message, sent to one named list at a time the shop picks or now | Claude · reversible | 2026-11-06 | Product messages fold in here (parent Q107); one list per campaign keeps counts and cost exact | decided |
| Q3 | What does the review show, and what if the numbers change by send time? | Who will get it, who is skipped and why (not opted in, stopped, capped), the template's category and price per message, and the estimated total in rupees; the shop confirms. A scheduled campaign recounts at send and goes to whoever qualifies then, never to more people than the shop confirmed | Claude · reversible | 2026-11-06 | The shop sees the cost before a send (parent Q8) | decided |
| Q5 | How is cost recorded and counted against the cap? | Each message is estimated from the dated rate table at review and recorded at its actual price, per delivered message, from Meta's status webhook, in paise; campaign totals are sums of integers. Spend counts against the shop's monthly cap (per calendar month, IST) on the estimate when a message is accepted for sending, corrected to the actual when Meta reports it. A send that would cross the cap goes to as many as fit and holds the rest, telling the shop | Claude · reversible | 2026-11-06 | Invariant 3; Meta charges per delivered message | decided |
| Q8 | What is the WhatsApp send port, and what does it guarantee? | One port every WhatsApp sender uses, which no caller can bypass: it takes a recipient, a template and its values, checks consent, STOP and both caps itself, and answers sent, skipped (with the reason) or held. It exposes `deliverByWhatsApp` (one message, idempotent on the caller's key) and `whatsAppCounts` (marketing messages per buyer per shop today and this week, read by the hub's global cap). A `purpose` of utility skips the frequency caps (parent Q40) but still needs consent and still counts toward spend. Sends are queued in batches on the worker, within Meta's throughput (20 a second under coexistence) and the shop's messaging tier | Claude · reversible | 2026-11-06 | Parent Q40: every caller passes the same checks | decided |
| Q13 | When does a campaign go, and can it be changed? | At the minute the shop picked, IST, any time of day (parent Q40). A campaign due during an outage goes when the worker resumes, unless more than 6 hours late, when it is held for the shop to send or cancel. It can be edited or cancelled until it starts sending, then only stopped, and those not yet sent are not charged | Claude · reversible | 2026-11-06 | The shop stays in control | decided |
| Q14 | What does a campaign report, including failures? | Sent, delivered, read, failed and skipped, each with reasons, the actual cost, and buttons tapped where the template has them. Failures are recorded per recipient with Meta's error codes in plain words (not on WhatsApp, blocked, Meta limit) and retried only when temporary, three times; the port answers its caller so the hub can fall back to email (parent Q61, Q66) | Claude · reversible | 2026-11-06 | What Meta's status webhook gives | decided |
| Q20 | Does a shop see Meta's quality rating for its number? | Yes, on the WhatsApp settings page beside the caps, with what a drop means; fed by Meta's quality webhook | Claude · reversible | 2026-11-06 | Explains why caps exist when the shop raises them (parent Q40) | decided |

## Parked (Later)
None. A/B tests, recurring campaigns and click attribution to orders are not asked for by any
acceptance here; raise them as new questions if wanted.

## Merged ids
Absorbed in the 2026-11-21 audit; read the id on the right.
Q2 → parent Q9 · Q4 → Q3 · Q6 → Q5 · Q7 → parent Q8 · Q9 → Q8 · Q10 → Q8 · Q11 → Q14 · Q12 → Q13 · Q15 → parent Q75 · Q16 → parent Q47 · Q17 → parent Q37 · Q18 → Q8 · Q19 → parent Q8
