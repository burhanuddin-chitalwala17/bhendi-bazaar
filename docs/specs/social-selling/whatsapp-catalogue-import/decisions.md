# Decisions — social-selling/whatsapp-catalogue-import

- **Verified:** 2026-11-22

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only
> implemented ones ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste. Claude decides the
> rest, marked `Claude · reversible`. Ids here are this subfeature's own; "parent Qn" means
> [../decisions.md](../decisions.md). Binding here from the parent: Q7, Q47, Q102.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | Does an item whose own id equals one of our product SKUs link by itself? | Yes, as Amazon and Flipkart listings with an exact SKU do (channel-import); every other match is suggested by name and photo and confirmed by the shop | Owner | 2026-11-22 | Same rule on every channel; an exact id is not a guess | decided |
| Q2 | Does WhatsApp change as items are settled, or only at Done? | Only at Done, in one push | Owner | 2026-11-22 | A buyer never sees a catalogue half old and half new | decided |
| Q3 | What happens to items the shop grouped as one item with options? | Settled item by item now; making them one family uses the existing family flow afterwards | Owner | 2026-11-22 | Keeps this step small; family-merge already exists | decided |
| Q4 | What stock does a product added from WhatsApp get? | The shop answers "How many do you actually have?", as product-merge asks, since WhatsApp holds no count | Claude · reversible | 2026-11-22 | product-merge Q8's wording and reason; stock is never invented | decided |
| Q5 | Which screen settles the items? | The marketplace Settle screen, given WhatsApp as a source: the same three choices, wording and review. No second settle screen | Claude · reversible | 2026-11-22 | One vocabulary across channels; shops already know it (parent Q47) | decided |
