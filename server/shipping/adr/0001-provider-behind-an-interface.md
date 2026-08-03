# ADR-0001: Every carrier sits behind a provider interface

- **Date:** 2026-08-03
- **Status:** Accepted
- **Context:** Shipping is the one domain expected to speak to several external systems over time — carriers are switched for price, coverage, or service quality, and an Indian store may well need more than one at once for different regions. Carrier APIs differ in every particular: auth model, rate request shape, status vocabulary, booking semantics, webhook format. Without a boundary, those differences spread into checkout and the admin console, and swapping or adding a carrier becomes a change across the codebase rather than an addition to it.
- **Decision:**
  1. `domain/provider.interface.ts` defines the carrier contract. The orchestrator depends only on it.
  2. A carrier is an implementation under `providers/<name>/`, containing its own config, its own types, and a **mapper** translating its shapes to ours in both directions.
  3. **No carrier-specific branching outside its own folder.** A conditional on a provider name in the orchestrator, a service, or a route is a defect.
  4. Shared behaviour lives in `base.provider.ts`; a provider extends it rather than reimplementing auth plumbing.
  5. If a second carrier cannot be expressed through the interface, **the interface changes** — via a new ADR — rather than the carrier being special-cased.
- **Alternatives considered:**
  - *Call the carrier's API directly from services* — rejected. Simplest for one carrier, and the reason carrier details leak everywhere by the second. The cost is not paid at the point where the shortcut is taken.
  - *Use a shipping aggregator's SDK as the abstraction* — rejected. It substitutes someone else's abstraction for ours and makes the aggregator unswappable, which is exactly the dependency this ADR exists to avoid. It also assumes every carrier we want is on that aggregator.
  - *Defer the abstraction until a second carrier exists (YAGNI)* — considered seriously, and rejected on the specific grounds that multiple carriers are a near-certainty for this product, not a speculative future. Where a second implementation is genuinely unforeseen, deferring is right; here it is not.
  - *A generic plugin system with runtime registration from configuration* — rejected as disproportionate. Providers are known at build time; `init.ts` registering them is sufficient.
- **Consequences:**
  - ✅ Adding a carrier is a new folder and a registration line.
  - ✅ Selection strategies operate over a uniform quote shape, so they stay pure and testable.
  - ✅ Carrier APIs can be tested through a double at the interface, with no live calls.
  - ⚠️ One extra indirection for what is currently a single carrier, and a mapper to maintain per carrier.
  - ⚠️ The interface is only as good as its coverage of real carrier behaviour. The first genuinely different carrier will likely force a change — that is expected, and rule 5 says how to handle it.
