# ADR-0004: Money is stored and computed as integer paise

- **Date:** 2026-08-03
- **Status:** Accepted
- **Context:** Every monetary column is `Float` (`DOUBLE PRECISION`), and totals are computed by floating-point multiply-and-sum in JavaScript.

  The decisive evidence that this already costs something: order totals are compared with an epsilon rather than for equality. That tolerance exists because exact equality *already fails* — the codebase has quietly accepted that its own arithmetic disagrees with itself. An epsilon on money is also a window, not just an imprecision: any check written against it accepts a range of values rather than one.

  Razorpay's API takes amounts as integer paise, so the boundary already wants integers; the conversion was happening late and lossily.
- **Decision:**
  1. **All monetary columns become `Int`, denominated in paise.** `price`, `salePrice`, `itemsTotal`, `shippingTotal`, `discount`, `grandTotal`, `shippingCost`, `rate`.
  2. **All arithmetic is integer arithmetic.** Multiplication and addition only; no division on money except where a rule demands it (percentage discount), and then with an explicit documented rounding function, applied once, at a stated point.
  3. **Totals are compared with `===`.** An epsilon comparison on money is a defect to be fixed, not a tolerance to be tuned.
  4. **Formatting happens at the edge.** `src/lib/format.ts` converts paise to a display string. Paise never reach a UI component as a pre-divided float.
  5. **The gateway receives `grandTotal` directly** — already paise, no conversion, no `* 100`.
- **Alternatives considered:**
  - *Prisma `Decimal` (Postgres `NUMERIC`)* — genuinely correct and the standard answer, but rejected here. It arrives in JS as a `Decimal` object requiring `.add()`/`.mul()` everywhere, serializes awkwardly through `NextResponse.json`, and the Razorpay boundary wants an integer regardless. Integer paise gives exactness with plain `+`/`*` and no wrapper type crossing the wire. Revisit if a requirement appears for sub-paise precision or multi-currency with differing minor units.
  - *Keep `Float` and round at every boundary* — rejected. It is the current design; rounding at boundaries does not prevent intermediate drift, and it leaves the epsilon comparison in place.
  - *Store a string and parse on read* — rejected. Loses arithmetic and ordering in the database, so `ORDER BY price` and `SUM(grandTotal)` stop working.
  - *Store rupees as `Int` and accept losing paise* — rejected. Indian pricing uses paise (`₹499.50` is ordinary), and shipping rates are rarely whole rupees.
- **Consequences:**
  - ✅ Cart, order row, gateway charge, and revenue reports agree exactly. Currently they can differ by cents.
  - ✅ The epsilon comparison — and the tampering budget it granted — is deleted, not narrowed.
  - ✅ `SUM(grandTotal)` in Postgres is exact, so revenue aggregation stops accumulating error.
  - ⚠️ **A migration over existing rows**, converting rupees to paise (`price * 100`, rounded). This is a data migration, not just a type change, and must be written with an explicit `UPDATE` — not a bare `ALTER COLUMN TYPE`, which would reinterpret 499.50 as 500 and lose the paise. Requires a verified backup first.
  - ⚠️ Every read site that formats a price must be updated in the same PR, or prices render 100× too large. This is loud and immediately visible rather than subtle, which is the preferable failure mode.
  - ⚠️ Historical `Order` rows created before [ADR-0002](0002-server-holds-pricing-authority.md) hold client-supplied values; converting them preserves numbers that were never verified. Convert them for schema consistency, but see ADR-0002's consequences on their trustworthiness.
