# Decisions — bulk-publish

- **Verified:** 2026-11-22

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only
> implemented ones ([ADR-0062](../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste. Claude decides the
> rest, marked `Claude · reversible`. Binding here: social-selling Q102; marketplace-integration
> Q44; marketplace-publish Q2, Q7, Q9, Q11, Q12 (implemented, kept as they are).

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | How does "see every change before it is sent" (marketplace-publish Q2) hold for hundreds of products? | A grouped review (so many new listings, so many changes, so many left out with why) in which every product has a checkbox: all ready ones ticked, any group or product untickable, any product opening to its full old-against-new view. Send sends only what is ticked | Owner | 2026-11-22 | Keeps the rule's purpose (nothing reaches a marketplace unseen) without 300 screens; the owner wants each product selectable | decided |
| Q2 | How does a product get its Amazon page in bulk? | Suggested per product (a barcode match "Sell on this page", otherwise "Create a new page"; a family as a family), with one tap to accept every suggestion and any one changeable | Owner | 2026-11-22 | marketplace-publish Q7 asks the shop per product; a suggestion keeps the shop's choice, at one tap for the many | decided |
| Q3 | Where does the screen live, and what does it orchestrate? | One screen per channel, opened from the channel's card and the Products page; it calls readiness-fix's pages and marketplace-publish's create and send, and adds no second way to fix or send | Claude · reversible | 2026-11-22 | Built pieces are kept, not rewritten (owner, 2026-11-22) | decided |
