# Architecture Decision Records — shipping domain

Decisions internal to `server/shipping/**`. Cross-domain and project-wide decisions live in [`/docs/adr/`](../../../docs/adr/). This folder has its own sequence starting at 0001.

Format, and the rules for adding and superseding, are in [`/docs/adr/README.md`](../../../docs/adr/README.md). `/bb-sdlc adr-new` walks it.

## Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [0001](0001-provider-behind-an-interface.md) | Every carrier sits behind a provider interface | Accepted | 2026-08-03 |
| [0002](0002-credentials-via-admin-not-env.md) | Carrier credentials are entered through the admin console, encrypted at rest | Accepted | 2026-08-03 |
| [0003](0003-normalise-carrier-status-on-entry.md) | Carrier status vocabularies are normalised at the boundary | Accepted | 2026-08-03 |
