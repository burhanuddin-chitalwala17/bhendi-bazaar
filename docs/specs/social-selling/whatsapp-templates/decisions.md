# Decisions — social-selling/whatsapp-templates

- **Verified:** 2026-11-06

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste.
> Claude decides the rest, marked `Claude · reversible`. Ids here are this subfeature's own; "parent Qn"
> means [../decisions.md](../decisions.md). Binding here from the parent: Q7, Q8, Q9, Q30, Q37, Q65, Q76, Q78.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | Which templates are in the starter set? | Six, per parent Q37: new arrivals, offer, back in stock, abandoned cart and auction (marketing); order update (utility). Each in English and Hindi (parent Q65): twelve submissions per shop | Claude · reversible | 2026-11-06 | The set the owner named; order update is the one utility template notification-hub needs | decided |
| Q2 | When is the starter set submitted? | Once WhatsApp connects, as a background job; a reconnect submits only what is missing or deleted | Claude · reversible | 2026-11-06 | Meta reviews in minutes to a day; ready before the shop's first campaign | decided |
| Q3 | Exact wording of the starter set (both languages)? | As drafted in ux.md's copy deck. The Hindi is read by a native reader before it is submitted to Meta | Owner | 2026-11-06 | Owner approved the English; Hindi checked first | decided |
| Q4 | May a shop edit a starter template? | No: it copies it into its own and edits the copy, which goes to Meta as a new template. Starter wording stays ours so every shop gets the same fix when we improve it | Claude · reversible | 2026-11-06 | Meta re-reviews any edit anyway; a copy keeps both | decided |
| Q5 | What can a shop's own template contain? | A category (marketing or utility, the shop picks with a one-line explanation of each), a language (English or Hindi), a header (none, text or an image from the media library), a body with up to three placeholders chosen from a closed list (buyer's first name, shop name, product name, product price, product link), an optional footer, and up to two buttons (visit link, quick reply). A STOP line is added to every marketing template | Claude · reversible | 2026-11-06 | Covers what a shop needs while staying inside Meta's template rules; closed placeholders mean we always know what fills them | decided |
| Q6 | Who chooses Meta's template category? | The shop picks; Meta may re-categorise on review, and we show Meta's answer and its price, not the shop's pick | Claude · reversible | 2026-11-06 | Meta decides category, and category decides cost (parent Q8) | decided |
| Q7 | What states does a template show? | In review, Approved, Rejected (with Meta's reason, cut to 300 characters, and what to change), Paused (low quality; with when it resumes), Disabled. Kept in step by Meta's template-status webhook, and a daily look as a backstop | Claude · reversible | 2026-11-06 | Mirrors marketplace issues (marketplace-publish Q6); webhooks can be missed | decided |
| Q8 | What happens to a scheduled campaign whose template is paused or rejected? | It does not send; the campaign shows Held with the reason, and the shop picks another approved template or waits. Nothing is charged | Claude · reversible | 2026-11-06 | A paused template cannot send; never fail silently | decided |
| Q9 | Can a template be deleted? | Archived here and deleted at Meta. One used by a sent campaign stays readable in that campaign's history | Claude · reversible | 2026-11-06 | Records people authored are retired, not deleted (ADR-0032) | decided |
| Q10 | Is a template's price shown? | Yes: its category's price per delivered message for India, read from one dated rate table in paise, shown beside the template and on the campaign review | Claude · reversible | 2026-11-06 | The shop sees cost before a send (parent Q8); rates change, so they carry a date | decided |
| Q11 | Where does the rate table come from? | A dated table in code, from Meta's published India rates, with its source and checked date, changed in code when Meta changes them. The owner is told on the day Meta announces a change | Claude · reversible | 2026-11-06 | Meta has no price API; matches channel mappings as dated data (ADR-0054) | decided |
| Q12 | Which Hindi script? | Devanagari | Claude · reversible | 2026-11-06 | Meta's `hi` locale; readable on every phone | decided |
| Q13 | How many own templates may a shop have? | No cap of ours; Meta's own limit (per account) applies, explained when reached | Claude · reversible | 2026-11-06 | No reason to cap below Meta | decided |

## Parked (Later)
None. Template analytics (read and click rates) belong with campaign reports, not here.
