# Decisions — channel-connectors

- **Verified:** 2026-10-20

> Replaced in place until implemented, superseded after ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Ids here are this subfeature's own; "parent Qn" means [../decisions.md](../decisions.md). Decided
> there and binding here: parent Q3, Q4, Q6–Q13, Q36.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | Does connecting also read and match listings? | No: that is channel-import. This subfeature ends at a healthy connection | Claude · reversible | 2026-10-20 | One outcome per feature (parent Q2) | decided |
| Q2 | Where is Flipkart's one-shop-per-account rule enforced? | In channel-import, the first time listings are read, since Flipkart's consent does not name the account | Claude · reversible | 2026-10-20 | Nothing earlier can identify a Flipkart account | decided |
| Q3 | Do platform staff get a view of connections now? | Later | Claude · reversible | 2026-10-20 | A new screen no acceptance criterion needs | parked |
| Q4 | What happens to the record on disconnect? | Credentials deleted; the connection kept as disconnected, with who connected and when | Claude · reversible | 2026-10-20 | Records people authored are retired, not deleted (ADR-0032) | decided |
| Q5 | Where does Channels sit in the shop menu? | Its own item, directly under Products, titled "Channels" | Owner | 2026-10-20 | It is the place a shop says where it sells | decided |
| Q6 | What does the card show when healthy? | Connected, by whom and when, last successful contact, and Amazon's re-approval date | Claude · reversible | 2026-10-20 | Enough to trust it, nothing to act on | decided |
| Q7 | What if the seller cancels on the marketplace's page? | Back on Channels, card unchanged, a neutral note: nothing was connected | Claude · reversible | 2026-10-20 | Cancelling is a choice, not an error | decided |
| Q8 | What if a reconnect or renewal consents with a different account? | Refused: reconnect and renew only accept the same account. To switch, disconnect, then connect the new one. Amazon is checked at once; Flipkart cannot be, and is caught when its listings are read | Owner | 2026-10-20 | One path to switch accounts is simpler than a silent replace. was: Amazon allowed and replaced with a notice (Claude) | decided |
| Q9 | Is disconnect confirmed, and what does it say? | Yes, in a dialog: what stops (stock, prices, orders no longer update), what stays (listings on the marketplace stay live; products and their links here stay and resume if the same account reconnects), the risk (the marketplace keeps selling at its last stock) and how to revoke on the marketplace | Owner | 2026-10-20 | A seller must know their listings keep selling after disconnecting. was: dialog saying what stops and how to revoke (Claude) | decided |
| Q10 | When is a marketplace "unavailable"? | When it is not in the one switch, `CHANNELS_CONNECT`, or its credentials are not configured. No other flags | Owner | 2026-10-20 | Switches must not shape the architecture; one enablement flag is enough. was: "switched off by the platform" with pilot and draft flags (Claude) | decided |
| Q11 | What if the shop is suspended? | Its connections stay, but nothing calls the marketplace until it is reinstated | Claude · reversible | 2026-10-20 | Suspension already hides the shop; acting for it would contradict that | decided |
| Q12 | Where does a problem show besides the card? | One banner on the shop's dashboard, for renewal due and needs reconnecting | Claude · reversible | 2026-10-20 | A seller does not visit Channels daily | decided |
| Q13 | Does connecting call the marketplace at all? | Yes, but changes nothing there: the code exchange, one read to confirm the access works (and, for Amazon, who the seller is), renewals, and a daily health check behind "Last checked" | Claude · reversible | 2026-10-20 | A connection nobody has tested is not healthy | decided |
| Q14 | Do other shops get connectors before channel-import exists? | There are no other shops yet, so `CHANNELS_CONNECT` may be on in production now. If a shop joins before channel-import ships, it is emptied in production until then | Owner | 2026-10-20 | Only the owner uses production today; a dead end matters once a real seller can reach it. was: empty in production until channel-import ships | decided |
| Q15 | How is A8 verified on real accounts? | Amazon on dev.bhendi-bazaar.com; Flipkart on production with the switch on. No second Flipkart app | Owner | 2026-10-20 | No other users exist, so production is the owner's test bed. was: open, a second Flipkart app recommended | decided |
| Q16 | How do the Amazon draft link and the 25-shop cap work without a flag? | A fact in the Amazon provider (app unlisted): consent URL carries `version=beta`, cap 25. Changed in code once, when the Appstore listing is approved (parent Q36) | Claude · reversible | 2026-10-20 | It changes once, ever; a flag would outlive its purpose | decided |
