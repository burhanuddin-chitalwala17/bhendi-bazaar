# Decisions — channel-connectors

- **Verified:** 2026-10-20

> Append-only ([ADR-0061](../../../adr/0061-a-feature-is-cut-to-one-outcome-its-decisions-are-logged-and-its-ux-is-signed-off-before-the-trd.md)).
> Ids here are this subfeature's own; "parent Qn" means [../decisions.md](../decisions.md). Decided
> there and binding here: parent Q3, Q4, Q6–Q13, Q36.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | Does connecting also read and match listings? | No: that is channel-import. This subfeature ends at a healthy connection | Claude · reversible | 2026-10-20 | One outcome per feature (parent Q2) | decided |
| Q2 | Where is Flipkart's one-shop-per-account rule enforced? | In channel-import, the first time listings are read, since Flipkart's consent does not name the account | Claude · reversible | 2026-10-20 | Nothing earlier can identify a Flipkart account | decided |
| Q3 | Do platform staff get a view of connections now? | Later | Claude · reversible | 2026-10-20 | A new screen no acceptance criterion needs | parked |
| Q4 | What happens to the record on disconnect? | Credentials deleted; the connection kept as disconnected, with who connected and when | Claude · reversible | 2026-10-20 | Records people authored are retired, not deleted (ADR-0032) | decided |
| Q5 | Where does Channels sit in the shop menu? | Recommended: its own item, directly under Products, titled "Channels" | Owner | 2026-10-20 | Asked; it is the place a shop says where it sells | open |
| Q6 | What does the card show when healthy? | Connected, by whom and when, last successful contact, and Amazon's re-approval date | Claude · reversible | 2026-10-20 | Enough to trust it, nothing to act on | decided |
| Q7 | What if the seller cancels on the marketplace's page? | Back on Channels, card unchanged, a neutral note: nothing was connected | Claude · reversible | 2026-10-20 | Cancelling is a choice, not an error | decided |
| Q8 | What if a reconnect consents with a different account than before? | Amazon: allowed, replacing the old one, with a notice naming the change. Flipkart cannot tell; no notice | Claude · reversible | 2026-10-20 | Nothing is linked to the account yet in this subfeature | decided |
| Q9 | Is disconnect confirmed? | Yes, in a dialog that says what stops and how to revoke on the marketplace | Claude · reversible | 2026-10-20 | It stops every later sync | decided |
| Q10 | When is a marketplace "unavailable"? | When the platform has switched that channel's connect off, or its credentials are not configured | Claude · reversible | 2026-10-20 | The Flipkart switches (parent Q4) need a visible state | decided |
| Q11 | What if the shop is suspended? | Its connections stay, but nothing calls the marketplace until it is reinstated | Claude · reversible | 2026-10-20 | Suspension already hides the shop; acting for it would contradict that | decided |
| Q12 | Where does a problem show besides the card? | One banner on the shop's dashboard, for renewal due and needs reconnecting | Claude · reversible | 2026-10-20 | A seller does not visit Channels daily | decided |
