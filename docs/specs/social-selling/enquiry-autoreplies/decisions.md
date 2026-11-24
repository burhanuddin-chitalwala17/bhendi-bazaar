# Decisions — social-selling/enquiry-autoreplies

- **Verified:** 2026-11-22

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only
> implemented ones ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste. Claude decides the
> rest, marked `Claude · reversible`. Ids here are this subfeature's own; "parent Qn" means
> [../decisions.md](../decisions.md). Binding here from the parent: Q7, Q37, Q63, Q89.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | Are automatic replies on or off for a new shop? | Recommended: off until the shop turns them on, every reply pre-filled from its settings so turning on is one tap | Owner | — | Speaking for the shop is the shop's choice; pre-filling makes it effortless | open |
| Q2 | What do business hours drive? | Recommended: hours per day of the week in IST; outside them the greeting adds when the shop will reply. Inside them the greeting still goes at once, so no buyer waits silently | Owner | — | The away line sets an honest expectation; the greeting is the "no lost enquiry" promise | open |
| Q3 | Where do answers to common questions come from? | The shop's settings and store policies (delivery, cash on delivery, returns, pickup address), read live; a question with no answer there is not offered, never invented. The shop may reword any answer | Claude · reversible | 2026-11-22 | A wrong promise is worse than none (parent Q89) | decided |
| Q4 | How is a buyer's message matched to a question? | By the button tapped, or by keywords per question in English, Hindi and Hinglish, listed and editable on the Auto-replies page; no AI before step 8 | Claude · reversible | 2026-11-22 | Predictable, testable, free (parent Q89) | decided |
| Q5 | After a member replies, how long do automatic replies stay quiet in that conversation? | Recommended: 12 hours, changeable by the shop | Owner | — | Long enough that the shop and the bot never talk over each other in a live chat; short enough that the next day's enquiry is still answered | open |
| Q6 | How do the buttons appear on each platform? | Instagram: up to four starter questions on the profile and quick replies in a DM; WhatsApp: up to three reply buttons, or a list for more. Free inside the window the buyer's message opened | Claude · reversible | 2026-11-22 | Each platform's own interactive forms (INTEGRATIONS) | decided |
