# Decisions — marketplace-integration

- **Verified:** 2026-10-20

> Append-only ([ADR-0061](../../adr/0061-a-feature-is-cut-to-one-outcome-its-decisions-are-logged-and-its-ux-is-signed-off-before-the-trd.md)).
> The owner decides money, policy, irreversible data, external commitments and taste. Claude
> decides the rest, marked `Claude · reversible`. A subfeature's own decisions go in its own
> decisions.md and cite these ids. Decisions made 2026-10-15 to 2026-10-20 in planning sessions.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | What is the shape of the sync? | Bhendi Bazaar is the hub: import once, changes go out, orders and status come back | Owner | 2026-10-19 | Two systems both editing a title cannot be reconciled safely | decided |
| Q2 | How is the work cut? | Six subfeatures, in the order in spec.md | Owner | 2026-10-20 | Each is one outcome and ships alone | decided |
| Q3 | Where does the code live? | A new `channels` domain: connections, platform listings, marketplace orders | Owner | 2026-10-15 | Keeps tokens and HTTP out of `listing`'s vocabulary | decided |
| Q4 | What if Flipkart lacks an API? | Amazon end to end; channel-neutral code; each Flipkart capability behind a switch | Owner | 2026-10-19 | Flipkart's catalogue API is unconfirmed (Q33) | decided |
| Q5 | Which process? | ADR-0061, with channel-connectors as its trial | Owner | 2026-10-18 | Scope, decisions and UX were being lost | decided |
| Q6 | Where does a shop manage channels? | A Channels page replacing "Where you sell"; what is connected is where it sells | Owner | 2026-10-15 | One answer instead of a toggle and a connection | decided |
| Q7 | What of channels with no account? | The own store is always on; Google and Meta turn on with one tap | Claude · reversible | 2026-10-15 | They read our feed and need no consent | decided |
| Q8 | May two shops share a marketplace account? | No: one account, one shop; the second is refused with the reason | Owner | 2026-10-15 | Shared listings double-count sales and fight over stock | decided |
| Q9 | Who may connect? | Any member of the shop | Owner | 2026-10-15 | Roles are not in use yet | decided |
| Q10 | How is Amazon's yearly renewal announced? | In the app only | Owner | 2026-10-15 | Email is not needed yet | decided |
| Q11 | Where are app credentials? | `FLIPKART_APP_ID/SECRET`, `AMAZON_APP_ID/SECRET` (Login with Amazon client), `AMAZON_SOLUTION_ID` (consent URL app id) | Owner | 2026-10-15 | Names already in `.env` | decided |
| Q12 | How are seller tokens stored? | Encrypted under a versioned key, rotatable without reconnecting anyone | Claude · reversible | 2026-10-15 | The shipping helper has no key version | decided |
| Q13 | Which redirect URLs? | Amazon: live and `dev.`; Flipkart: live until a dev app is needed | Claude · reversible | 2026-10-15 | Flipkart allows one redirect per app | decided |
| Q14 | What comes in on connect? | Every product on that marketplace | Owner | 2026-10-19 | The shop starts from what it already sells | decided |
| Q15 | How are duplicates found? | By SKU and by name | Owner | 2026-10-19 | The identifiers both platforms share | decided |
| Q16 | Who decides two products are one? | The owner | Owner | 2026-10-19 | A wrong merge mixes two products' stock | decided |
| Q17 | Does an exact SKU match need asking? | No: it links by itself and can be undone; a similar name only suggests | Owner | 2026-10-20 | Exact SKU is the seller's own identifier | decided |
| Q18 | Whose content wins at a merge? | The more complete side's by default; the owner can switch | Owner | 2026-10-20 | The master should be the richest version (Q25) | decided |
| Q19 | What if prices differ? | A base price (the store's) and an optional override per platform; import keeps each platform's current price | Owner | 2026-10-20 | Nothing changes on a marketplace by importing | decided |
| Q20 | What if quantities differ at a merge? | Ask "How many do you actually have?", pre-filled with the lower count | Owner | 2026-10-20 | Physical stock is one number; the lower is the safe side | decided |
| Q21 | How do master and platform relate? | One master; each platform listing inherits it and stores only overrides | Owner | 2026-10-19 | Edit once, differ only where meant | decided |
| Q22 | Where is a platform listing edited? | Its own screen, used at publish and afterwards | Owner | 2026-10-19 | The same editor for both moments | decided |
| Q23 | Where are platform-only fields entered? | On the master product, never on the platform screen | Owner | 2026-10-19 | The seller fills nothing per platform | decided |
| Q24 | Can quantity differ per platform? | No: master only, identical everywhere, no buffer | Owner | 2026-10-20 | Independent counts make stock impossible to track. Replaces the per-channel buffer agreed 2026-10-15 | decided |
| Q25 | How complete is the master? | The most complete version: every fact any connected platform needs | Owner | 2026-10-19 | The richest listing serves the store and every new channel | decided |
| Q26 | Does that make the master form long? | It asks only what the product's type and the connected platforms need, when needed | Claude · reversible | 2026-10-19 | The product-form rule already in use | decided |
| Q27 | Where does MRP live? | On the master only | Claude · reversible | 2026-10-19 | The printed legal price cannot differ by platform | decided |
| Q28 | Which fields are locked on a platform listing? | Quantity, MRP, SKU, barcode, HSN and tax code, brand, legal label, net quantity | Owner | 2026-10-20 | Identity and legal facts must match everywhere | decided |
| Q29 | What may a platform listing change? | Everything else: title, description, photos (choice and order), selling price, listed/paused, platform-only fields | Owner | 2026-10-20 | Each marketplace rewards different content | decided |
| Q30 | How often are orders checked? | Every 5 minutes; instant notifications later (Q34) | Owner | 2026-10-20 | Amazon allows about one order search per three minutes per shop | decided |
| Q31 | How is drift corrected? | A daily resync reads every linked listing and compares it with ours. Replaces the hourly re-push proposed 2026-10-20 | Owner | 2026-10-20 | Changes made on the marketplace are found, not overwritten | decided |
| Q32 | What if a marketplace sells stock already gone? | Record it and flag it as oversold; never refuse it | Claude · reversible | 2026-10-15 | The sale has already happened on the marketplace | decided |
| Q33 | Can Flipkart create a new product by API? | Unknown: ticket reopened 2026-10-20 asking which endpoint carries category, attributes and images | Flipkart | 2026-10-20 | `POST /listings/v3` needs an existing FSN | open |
| Q34 | Instant sale notifications? | Later: Flipkart webhook (VAPT, NDA), Amazon via an AWS queue | Owner | 2026-10-15 | Polling works without either | parked |
| Q35 | A safety stock on the master? | No | Owner | 2026-10-20 | With a quantity of 1 it hides the product from every marketplace | decided |
| Q36 | Amazon Appstore listing? | Later, before about 20 Amazon shops | Claude · reversible | 2026-10-15 | It lifts the 25-shop cap and takes 3–4 weeks | parked |
| Q37 | Returns, Meesho, reporting, barcode or image matching? | Later; returns as their own feature | Claude · reversible | 2026-10-20 | Each is a new capability, not an edge of these six | parked |
| Q38 | Does a cancelled marketplace order restock? | Yes, before dispatch, in inventory-sync | Claude · reversible | 2026-10-20 | Otherwise stock drifts down with every cancellation | decided |
| Q39 | What does the seller do with a difference the resync finds? | Keep ours (we push) or take theirs (into that platform listing, optionally for all platforms). Nothing is overwritten silently | Owner | 2026-10-20 | Pushing is the seller's decision | decided |
| Q40 | Is a quantity difference corrected without asking? | Yes: the master quantity is pushed at once and the correction is recorded for the seller to see | Owner | 2026-10-20 | Waiting lets a marketplace sell stock that does not exist | decided |
| Q41 | What is the parent spec called? | `marketplace-integration`; it was briefly `marketplace-sync` | Owner | 2026-10-20 | "Sync" is one subfeature's job (inventory-sync), so the parent must not sound like it | decided |

## Parked (Later)
- Q34 — instant sale notifications; inventory-sync layers them on its one order-recording step.
- Q36 — the Amazon Appstore listing, with the OAuth Login URI flow it needs.
- Q37 — returns, Meesho, sales reporting, matching by barcode or image.
