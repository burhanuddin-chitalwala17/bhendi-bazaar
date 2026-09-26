# Spec — supply-chain-integrity

- **Summary:** What the store ships carries no published vulnerability and no committed secret, established by the pipeline
- **Status:** Draft
- **Domain:** cross-domain
- **Phase:** 4 — Enforcement
- **Verified:** 2026-09-21
- **References:** [trd.md](trd.md), [DEPENDENCIES.md](../../DEPENDENCIES.md), [TESTING.md](../../TESTING.md), [OPERATIONS.md](../../OPERATIONS.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is

The code the store deploys is known to be free of published vulnerabilities and free of committed secrets, and that is established by the pipeline rather than by anyone remembering to check.

## Why

The store's own code is reviewed against seven invariants before every merge. The code it *ships* is mostly not its own — it is several hundred packages, and nothing currently looks at them. An audit of the production dependency tree today reports thirty-three known vulnerabilities, four of them critical, and none of that is visible anywhere in the pipeline or in any document an operator reads. The count is not the point; the absence of a mechanism is, because the count will be different next month and nobody would know that either.

Most of what is there is transitive and inherited rather than chosen — a vulnerable identifier package pulled in through a spreadsheet library and again through the email provider's dependency. That shape matters for the response: the fix is usually to move a direct dependency forward, sometimes to pin a transitive one, and occasionally to accept a finding with a stated reason. What must not happen is the tempting automatic remedy, which in this tree would downgrade the database toolchain by a major version to satisfy a moderate advisory — a cure substantially worse than the disease, and the reason this needs a stated policy rather than a command in a runbook.

The same absence covers secrets. The repository holds several live connection strings in its environment file, and by the project's own reckoning five of them are read by nothing — leftovers from provisioning that nobody pruned. Nothing checks that one of those never reaches a commit, and an accidental commit of a database URL is not a thing to discover by reading history later.

## Requirements

- R1 — A dependency with a published vulnerability at or above an agreed severity blocks the pipeline. Shipping one is a decision somebody makes explicitly, not something that happens quietly.
- R2 — An accepted finding is recorded with its reason and revisited, rather than silenced. A permanently suppressed advisory is indistinguishable from an unnoticed one.
- R3 — Dependency updates arrive continuously and in reviewable pieces, so the tree does not drift far enough that catching up is its own project.
- R4 — A credential or connection string cannot reach the repository's history unnoticed, whether in a commit, a branch or a configuration file.
- R5 — The store's own code is scanned for the classes of defect that review is worst at catching consistently, and a finding is reported against the change that introduced it.
- R6 — Every gate is blocking or is not a gate. A check that reports and passes teaches people to ignore it, and the pipeline currently contains one such check.
- R7 — Connection strings the application does not read are not present. What is present is documented as to why.
- R8 — None of this costs anything. The store runs on free tiers by deliberate choice, and a security control that needs a paid plan to exist will not exist.

## Product acceptance

- A1 — Opening a change that introduces a package with a critical advisory fails the pipeline, naming the package and the advisory.
- A2 — A dependency update appears as a reviewable proposal without anyone requesting it.
- A3 — Committing a connection string on a branch fails before it can be merged.
- A4 — An accepted advisory is visible as accepted, with a reason and a date, to someone reading the repository rather than someone who was present at the decision.
- A5 — The unused connection strings are gone from the environment file, and what remains is explained in the operations document.

## Out of scope (this feature)

- Runtime protection and intrusion detection; this feature is about what gets built and deployed, not about traffic.
- Dependency licence compliance.
- Penetration testing and third-party audit.
- The existing documentation-integrity gate, which is adjacent and already landed.
