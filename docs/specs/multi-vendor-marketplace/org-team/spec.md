# Spec — org team

- **Status:** Not drafted — scope agreed, requirements provisional, no TRD yet
- **Domain:** catalog, identity
- **Phase:** 3 — Fulfilment
- **Verified:** 2026-08-08
- **Depends on:** portal-separation
- **References:** [../spec.md](../spec.md), [../data-model.md](../data-model.md)

> Requirements and product approach only. A `trd.md` is written when this subfeature is picked up.

## What this feature is
An organisation's people can be listed, added, given a role, and removed.

## Why it is separate
Where the role stored by organisations-and-membership first gets read. Whether adding a person is direct or by invitation is this subfeature's decision.

## Requirements (provisional)
- **R1** — A member can see who else belongs to the organisation and with what role.
- **R2** — Someone entitled to do so can add a person, change a role, and remove a member.
- **R3** — An organisation cannot be left with nobody able to administer it.
- **R4** — Removing a member ends only the relationship.
