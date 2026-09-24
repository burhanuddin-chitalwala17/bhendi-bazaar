# TRD — shipment-lifecycle

- **Status:** Implemented — PR-135 (vocabulary, adapter, transition guard, migration), PR-137 (restock and ledger reversal). Refund execution stays manual by decision; the customer-return direction is unbuilt until that flow is specified
- **Domain:** shipping (consequences in checkout, catalog, payments, payouts)
- **Phase:** 3 — Fulfilment & marketplace
- **Verified:** 2026-09-24
- **References:** [spec.md](spec.md), [ADR-0005](../../adr/0005-payment-state-server-only.md), [ADR-0007](../../adr/0007-conditional-stock-decrement.md), [ADR-0020](../../adr/0020-money-bearing-records-never-cascade.md), [ADR-0033](../../adr/0033-a-domain-is-reached-through-its-public-surface.md)

> Technical approach and decisions. No code — references to existing code only.

## Approach

`server/shipping/utils/statusNormalizer.ts` already is the adapter the spec asks for: one map
per courier into one internal set, with Shiprocket, Delhivery and BlueDart tables already
written. The architecture is right. What is missing is a canonical set worth mapping into, and
the rule that nothing writes the column except through it.

## Decisions

- **D1 — Eleven states, one direction each.** Forward: `PACKING`, `PICKED_UP`, `IN_TRANSIT`,
  `OUT_FOR_DELIVERY`, `DELIVERY_FAILED`, `DELIVERED`. Backward: `RTO_IN_TRANSIT`,
  `RTO_DELIVERED`. Terminal-other: `CANCELLED`, `LOST`, `DAMAGED`.

- **D2 — The return leg is two states, not a mirror of the forward one.** Couriers report RTO
  granularly (`rto_ofd`, `rto_ndr`, `rto_acknowledged`); we collapse that to *coming back* and
  *back*. The distinction that changes what we do is only ever "has it arrived", because that is
  when stock returns and the refund is owed. Finer RTO detail belongs in the event log, which is
  where the courier's own wording is already kept, not in a column decisions branch on.

- **D3 — `DELIVERY_FAILED` is non-terminal and has no separate NDR state.** An attempt failing
  and a report being raised are the same fact to us; the courier will retry and the parcel
  returns to `OUT_FOR_DELIVERY`. A count of attempts is data on the shipment, not a state.
  Rejected: modelling NDR separately, which adds a state nothing branches on differently.

- **D4 — `CANCELLED` is guarded by the transition table, not by the caller.** It is reachable
  only from `PACKING`. Attempting it after pickup fails with a message naming RTO as the
  remedy, because that is the actual operation the person wants (spec R4). This is the same
  reasoning as the order transaction being the only point that can refuse a sale: a rule
  enforced at the one write is a rule; enforced at the button it is a suggestion.

- **D5 — A customer return is a new `Shipment` on the same order, not a status.** It has its own
  AWB, its own courier journey and its own cost, and the original parcel really was delivered —
  rewriting its status would falsify that. A `direction` discriminator on `Shipment`
  (`OUTBOUND` / `RETURN`) is enough; the return's states are the same set read the other way
  round. Rejected: a separate `Return` aggregate, which duplicates every shipping field to
  express the same journey, and an `RMA` status on the order, which cannot represent two items
  returned out of five.

- **D6 — Every state declares its three consequences in one table**, beside the declaration:
  whether it restocks, whether it entitles a refund, and whether it reverses settlement. The
  question "what does this state mean for the money" must not be answerable only by reading
  four call sites.

  | State | Restock | Refund owed | Settlement |
  |---|---|---|---|
  | `CANCELLED` | yes | yes | reverse if credited |
  | `RTO_DELIVERED` | yes | yes | reverse |
  | `DELIVERED` | no | no | credit |
  | `LOST` / `DAMAGED` | **no** | yes | reverse; claim the courier |
  | all others | no | no | unchanged |

- **D7 — Restocking is conditional and idempotent, in the same shape as reservation.** The
  return of units is a guarded `updateMany` inside the transaction that records the terminal
  state ([ADR-0007](../../adr/0007-conditional-stock-decrement.md)), and a `restockedAt`
  timestamp on the shipment is what makes a duplicated courier event a no-op. A courier
  repeating `delivered` twice must not credit stock twice. Rejected: checking "did we already
  restock" by reading, which is the read-then-write that ADR-0007 exists to refuse.

- **D8 — Transitions are a declared table, and the table is the guard.** A move not in it is
  refused, which gives spec R9 (no going backwards) and R4 (cancel only before pickup) from one
  mechanism. A late or duplicated webhook naming a state we have passed is therefore ignored
  rather than applied — the common case, not an error.

- **D9 — An unmapped courier status is stored verbatim and flagged.** `Shipment.shipmentStatus`
  already holds the provider's own wording; when the normalizer has no entry, the canonical
  status is left unchanged, the raw value is kept, and the event is recorded as unmapped so the
  admin console can list them. Rejected: defaulting to `IN_TRANSIT`, which is how a lost parcel
  looks healthy for a week.

- **D10 — Order status is derived, never written beside the parcels.** An order is delivered
  when every parcel is; in transit when any is; returned when all came back. Deriving it is the
  same reasoning as [ADR-0023](../../adr/0023-bidding-status-stores-only-what-the-clock-cannot-decide.md):
  a stored answer to a question the rows already answer is a second source of truth that goes
  stale. `ORDER_STATUS` keeps only what the parcels cannot say — paid, abandoned, cancelled.

- **D11 — Migration maps the three live values.** `pending` → `PACKING`, `shipped` →
  `IN_TRANSIT`, `delivered` → `DELIVERED`. `shipped` is the one judgement call: it is written by
  the admin when a tracking number is added, which is the moment the courier takes it — so
  `PICKED_UP` is arguably truer. `IN_TRANSIT` is chosen because the next courier event will
  correct it within hours, and over-reporting progress to a buyer is worse than under-reporting
  it. A data migration, not a seed ([Invariant 7](../../CLAUDE.md)).

- **D12 — Writers go through the shipping service.** `api/admin/shipments/[id]/tracking` and the
  Shiprocket webhook currently write `Shipment.status` directly with literals. Both move behind
  one transition function, which is what makes D6, D7 and D8 unavoidable rather than optional
  ([ADR-0033](../../adr/0033-a-domain-is-reached-through-its-public-surface.md)).

## Decided 2026-09-24

- **`LOST` does not restock.** Confirmed: the units are gone and are written off against the
  courier claim. `DAMAGED` follows it.
- **`shipped` migrates to `IN_TRANSIT`**, not `PICKED_UP`, per D11.

## Built, and what was learned building it

- **Restock and ledger reversal run inside the transition's transaction** (PR-137). A parcel
  recorded as returned while its units stayed decremented is stock the shop has and cannot sell.
- **`refundOwed` is recorded and never acted on.** The owner's decision, 2026-09-24: a gateway
  refund is irreversible, so the entitlement is data and a human presses the button.
- **A return reduces what the platform owes, and that is the whole rule** (owner, 2026-09-24).
  Settlement here is bookkeeping: the platform records what it owes each org, pays outside the
  system, and marks it settled. There is no return window to wait for and none is wanted — the
  requirement is simply that the owed figure drops when goods come back. `reverseSale` writes the
  mirror entry, and `balancesFor` sums every live entry without filtering by kind, so the
  negative one counts against both `owedPaise` and `unclaimedPaise`. Asserted end to end rather
  than reasoned about: switching the reversal off leaves ₹255 owed where zero is correct.
- **The transition table, not `restockedAt`, is what actually prevents a double restock today** —
  a repeated terminal event is answered as `same-status` before restocking is reached. That made
  the first version of the idempotency test pass for the wrong reason. `restockedAt` is still the
  mechanism D7 names and is the one asserted, by reaching the restock path a second time
  deliberately.

## Not built yet

D5's `direction` column is deliberately absent — there is no customer-return flow to write it,
and a column nothing writes is a guess about a feature nobody has specified.
