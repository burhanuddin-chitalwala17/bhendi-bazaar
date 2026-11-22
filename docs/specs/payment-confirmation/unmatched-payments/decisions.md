# Decisions — unmatched payments

- **Verified:** 2026-11-22

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones (ADR-0062).
> Owner decides money, policy, irreversible data, external commitments, taste.
> Claude decides the rest, marked `Claude · reversible`. Other documents cite Q ids.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | What happens to a payment the gateway captured for an order the store had already released? | It is recorded the moment it is refused and owed back; the admin refunds it with one press. Nothing refunds on its own, and the order is not revived. | Owner | 2026-11-22 | No money moves without a person; reviving re-runs reservation outside checkout. | implemented |
| Q2 | Where is it recorded? | As a `Refund` row with no parcel, naming the gateway payment it refunds, so it joins the existing refunds list, claim, receipt lookup and states. | Claude · reversible | 2026-11-22 | One refund machine and one admin list; a second table would copy every safety the first already has. | implemented |
| Q3 | Which signal records it? | Only a captured payment with its amount: the `payment.captured` webhook. The browser's return records nothing. | Claude · reversible | 2026-11-22 | The browser cannot tell authorised from captured; an uncaptured authorisation is released by the gateway on its own. | implemented |
| Q4 | What does the webhook answer once it has recorded one? | 2xx. The owed row is the loud part, shown to the admin; a retry would only record the same row again. | Claude · reversible | 2026-11-22 | Same as a courier update we cannot apply (shipping Q32): recorded and visible is not silent. | implemented |
| Q5 | How much is owed? | What the gateway captured (the webhook's amount), not the order's total. | Claude · reversible | 2026-11-22 | It refunds the money taken; the two only differ if the gateway is wrong, and then the captured amount is still what the buyer is owed. | implemented |
| Q6 | What does the list call it? | "paid after release", in the Why column, with the order code and no parcel code. | Claude · reversible | 2026-11-22 | Says what happened in the admin's words; matches the list's other causes. | implemented |
| Q7 | Prototype for the UX stage? | None: no screen is added. `ux.md` lists the one changed row's states and copy. | Claude · reversible | 2026-11-22 | A row in an existing, signed-off list; a drawing would add nothing the table does not say. | implemented |

## Parked (Later)
- Q8 — An email to the buyer when this refund starts. The parcel refunds' email names a parcel; Razorpay emails the payer on a refund in the meantime. BACKLOG, Phase 2.
- Q9 — What the buyer's checkout says when its confirm is refused for a released order ("your order is saved" is wrong there). BACKLOG, Phase 2.
- Q10 — A sweep that asks the gateway about released orders, for a capture whose webhook never arrived. BACKLOG, Phase 5.
- Q11 — A capture whose amount differs from the order's total. It is still refused and fails loudly, as today. BACKLOG, Phase 2.
