# ADR-0012: `server/` modules are vertical slices by domain

- **Date:** 2026-08-03
- **Status:** Accepted
- **Context:** `server/` is currently organised along **three competing axes at once**, none of them chosen deliberately:
  - **by layer** — `services/`, `repositories/`, `domain/`
  - **by domain** — `shipping/`, which contains its own `domain/`, `providers/`, `services/`, `repositories/`, and `utils/`
  - **by caller** — `admin/`, which contains its own `repository/`, `services/`, and `types/`

  The clearest symptom is that `server/services/shipping/` exists alongside `server/shipping/`: a placeholder shipping implementation sits in the layer tree while the real shipping module sits in the domain tree, and fulfilment calls the one in the layer tree. The structure is not merely inconsistent, it is actively producing a defect.

  Two of the most damaging problems recorded elsewhere are **symptoms of layer-first organisation at this size rather than mistakes**. Under layer-first, "the products repository" has no unique home, so `server/repositories/products.repository.ts` and `server/admin/repository/products.repository.ts` are *both* legitimately named and both got written; the duplicated class and singleton names follow from the same cause ([ADR-0003](0003-one-repository-per-aggregate.md)). Nobody violated a rule — the structure permitted it.

  Layer-first and domain-first are each conventional in isolation. Mixing them is not, and organising by *caller* is not a recognised strategy at all.
- **Decision:**
  1. **`server/` is organised by domain — one directory per bounded context**, each owning its own layers internally. The domains are those listed in [`/CLAUDE.md`](../../CLAUDE.md): `catalog`, `cart`, `checkout`, `payments`, `shipping`, `identity`, `notifications`.
  2. **An external system sits behind an interface, in a `providers/<name>/` subfolder of the domain that owns it** — `payments/providers/razorpay/`, `shipping/providers/shiprocket/`, `notifications/providers/resend/`. `server/shipping/` already has this shape and is the template.
  3. **A domain's business logic is separate from its adapters.** "Is this order paid" belongs to `payments`, not next to an HTTP client. The `providers/` boundary is what keeps them apart.
  4. **`server/admin/` is removed.** Admin and storefront read the same tables, so an admin listing is a query on `catalog`, not a separate domain. Where an admin query differs, it is another method on the same repository — split by read vs write, never by caller ([ADR-0003](0003-one-repository-per-aggregate.md)). Admin *pages* remain grouped by audience in `src/app/(admin)/`, which is a UI concern and legitimately different.
  5. **`server/shared/`** holds only what genuinely spans domains: the Prisma client, cross-domain types, generic utilities. It is not a dumping ground — a type used by two domains belongs here; a type used by one belongs to that one.
  6. **A domain does not reach into another domain's internals.** It calls that domain's public surface. Cross-domain shapes are recorded in [CONTRACTS.md](../CONTRACTS.md).
  7. **Migration is per-domain and in two PRs**: a pure move (relocations and import updates, zero behaviour change), then any logic work. Never combined — a mechanical rename and a payment-logic change in one diff means neither is reviewed properly.
  8. **Each move PR updates the docs it invalidates**, in the same PR: the *Layers* section of [ARCHITECTURE.md](../ARCHITECTURE.md) (which currently describes the three-axis structure as current state, correctly, until the first domain moves), the domain table in [`/CLAUDE.md`](../../CLAUDE.md), and a `<domain>/CLAUDE.md` for the domain that now has a directory — splitting `server/services/CLAUDE.md` as checkout and payments separate. Use `git mv` so history follows.
- **Alternatives considered:**
  - *Keep layer-first and enforce uniqueness by convention* — rejected. This is effectively the status quo, and the status quo produced three repository trees and fourteen duplicated export names *without anyone breaking a rule*. Vertical slicing makes those unwriteable rather than discouraged, and a structural guarantee beats a convention that relies on everyone holding the whole tree in their head.
  - *Organise by integration — a folder per external service, plus a shared internal structure* — a real proposal and the closest competitor, since it correctly identifies that `shipping/`'s shape is good. Rejected on three grounds. "Is it an integration" is an unstable property: adding a tax API would promote `tax` to a top-level module and move everything, whereas domain membership does not change. `checkout` is the core domain and calls no external API, so it would remain scattered in the flat tree — inverse to its importance. And it conflates the *adapter* to an external system with the *business meaning* of the domain, which is exactly what decision 3 separates; `shipping` survives the conflation only because its logic largely *is* carrier-talking, and `payments` is not like that. The valuable part of this proposal is preserved as decision 2.
  - *Organise by caller — keep and extend `server/admin/`* — rejected. Two trees reading the same tables is how one row comes to have two shapes, which is the failure [ADR-0003](0003-one-repository-per-aggregate.md) exists to prevent.
  - *Leave it mixed and only add new code vertically* — rejected. It preserves both structures indefinitely, so "where does this go" stays ambiguous for every future file, and the duplicate-home problem persists for every aggregate that already has two.
  - *Extract domains into separate packages in a workspace* — rejected as premature. It would enforce boundaries at the module-resolution level, which is genuinely stronger, but adds build and tooling complexity for a single deployable. Directory discipline plus decision 6 is proportionate; revisit if boundaries prove unenforceable by convention.
- **Consequences:**
  - ✅ An aggregate has exactly one home, so the duplicate-repository and duplicate-name failures become structurally unavailable rather than merely against the rules.
  - ✅ A change to one domain touches one directory, which makes review, testing, and reasoning about blast radius local.
  - ✅ Domain-scoped `CLAUDE.md` and `adr/` become natural — each domain gets a real directory, so lazily-loaded rules work for all of them rather than just `shipping`.
  - ✅ Adding a carrier, gateway, or email provider is a new folder under an existing `providers/`, with the interface as the only contract.
  - ✅ The structure itself now teaches the pattern, so new code lands in the right place without anyone being told.
  - ⚠️ A large mechanical migration across most of `server/`, plus every import in `src/` that reaches into it. Sequenced per-domain (decision 7) so it never becomes one unreviewable change.
  - ⚠️ `git log` for a moved file needs `--follow`. Mitigated by using `git mv` and keeping moves in dedicated PRs.
  - ⚠️ `shared/` will attract things that do not belong in it. Decision 5 states the test; it needs enforcing at review, because nothing structural prevents it.
  - ⚠️ Deciding which domain owns a genuinely cross-cutting concern will occasionally be a real judgement call. When it is not obvious, it is usually a sign the concern is two concerns.
