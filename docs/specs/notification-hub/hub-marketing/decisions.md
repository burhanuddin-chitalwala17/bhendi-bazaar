# Decisions — notification-hub/hub-marketing

- **Verified:** 2026-11-22

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented
> ones
> ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Ids here are this subfeature's own; "hub Qn" means [../decisions.md](../decisions.md),
> "social-selling Qn" means [../../social-selling/decisions.md](../../social-selling/decisions.md).
> Binding: hub Q1, Q3; social-selling Q9, Q18, Q27, Q40, Q66.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | What does a marketing email's unsubscribe do? | One tap, no sign-in: withdraws that buyer's email consent for that sender only, recorded, and shows "You won't get offers from <shop> by email." WhatsApp consent is untouched | Claude · reversible | 2026-11-06 | social-selling Q27, Q9: per sender, per channel | decided |
| Q2 | What counts against the global cap, and where is it set? | Every marketing delivery to a buyer from that shop, across all channels, in the IST calendar day; a skipped send counts nothing and is recorded as skipped with its reason. The cap (default 3 a day) is set on one shop settings page, Notifications, under Shop in the menu, which also lists read-only the channels the shop has connected | Claude · reversible | 2026-11-06 | social-selling Q40; a day must mean the shop's day | decided |
