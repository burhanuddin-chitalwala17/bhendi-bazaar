# ADR-0003: One aggregate, one repository

- **Date:** 2026-08-03
- **Status:** Accepted
- **Context:** Three repository layouts coexisted — `server/repositories/`, `server/repositories/admin/`, and `server/admin/repository/` — and several aggregates were reachable through more than one. None was dead, which is worse than abandonment: every layout had real callers, and two modules writing the same table returned *differently shaped objects for the same row* because their `select`/`include` projections had diverged.

  The pattern repeated above the repository layer: duplicated class and singleton names, and closed sets declared more than once. The compiler cannot help here — duplicate names in different modules are simply different symbols, and separately declared string enums with matching values are mutually assignable — so this class of drift is invisible to `tsc` and only surfaces as a behavioural difference depending on which import path a caller happened to type.
- **Decision:**
  1. **Each table is reached through exactly one repository module.** That module is the only place its Prisma model is referenced.
  2. **One canonical layout:** `server/repositories/<aggregate>.repository.ts`. The `server/admin/repository/` and `server/repositories/admin/` trees are merged into it. Admin-specific *queries* are additional methods on the one repository, not a parallel repository — an admin list and a storefront list are two reads of one table.
  3. **A shared row shape per aggregate.** One `select`/`include` projection is defined once and reused; a caller needing a narrower shape derives from it rather than declaring a second.
  4. **No duplicated export names.** A class or singleton name appears once in the repo. Where a client-side `fetch` wrapper mirrors a server service, the client one is named for what it is (`productApiClient`, not `productService`).
  5. **Closed sets are declared once.** `ProductFlag` and equivalents live in one neutral module imported by both sides.
- **Alternatives considered:**
  - *Keep the admin/storefront split but share types* — rejected. It preserves two write paths to one table, which is the actual defect; shared types would only make the divergence harder to see.
  - *Introduce a formal DDD aggregate layer with domain entities and mappers* — rejected as disproportionate. The problem is duplicate modules, not insufficient modelling ceremony; YAGNI.
  - *Rename the duplicates and leave both in place* (e.g. `adminProductsRepository`) — rejected. Distinct names remove the import ambiguity but keep two write paths and two row shapes, so rows still differ by caller.
  - *Enforce with a lint rule instead of a convention* — accepted as a **complement**, not an alternative: a rule forbidding `prisma.<model>` outside that model's repository is worth adding once the merge is done. The convention has to exist first for the rule to encode.
- **Consequences:**
  - ✅ One row shape per aggregate, so a row cannot differ by import path.
  - ✅ Invariants (stock guards, ownership scoping, `select` projections that exclude `passwordHash`) have exactly one place to be enforced.
  - ✅ A lint rule can now mechanically enforce it.
  - ⚠️ A sizeable mechanical refactor across the repository, service, and DAL layers, touching many call sites. Best done as one focused PR per aggregate rather than all at once.
  - ⚠️ The single repository per aggregate will be larger. Acceptable; if a repository genuinely becomes unwieldy, split by *read vs write*, never by *caller*.
