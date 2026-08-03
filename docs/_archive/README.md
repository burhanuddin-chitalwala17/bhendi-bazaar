# ⚠️ ARCHIVED — superseded documentation, do not trust

- **Archived:** 2026-08-03
- **Status:** Superseded. Retained for salvage only.
- **Superseded by:** [../README.md](../README.md) and the docs tree it maps.

Everything in this directory is **undated and unverified**, and much of it describes code that no longer exists or never did. Do not cite it, do not follow its setup instructions, and do not treat any claim in it as current — including its claims about security controls, test coverage, and shipped features. It is retained only because a small amount of reasoning in it is not recoverable from the code.

> This file replaced the original `docs/README.md`, which was an index of documents that were never written. Its content remains available via `git log --follow docs/_archive/README.md`.

## Why it was archived

Roughly half of these 10,453 lines were pasted implementation code rather than references to it, and three quarters of the internal links were dead. Pasted code is an uncompiled copy of a moving target, so the tree went wrong as soon as the code moved — and nothing that large gets resynced by hand. The rule that replaced this practice is [ADR-0009](../adr/0009-docs-reference-code-never-copy-it.md).

`prisma/schema.prisma` is now the only schema reference, and [../ARCHITECTURE.md](../ARCHITECTURE.md) the only current-state description.

## What is worth salvaging

Under six pages of genuine signal, concentrated in the prose-dense files:

| File | Worth mining for |
|---|---|
| `TECH_STACK.md` | Design-system intent: fonts, palette, aesthetic → [../DEPENDENCIES.md](../DEPENDENCIES.md) *(done)* |
| `ENVIRONMENT_SETUP.md` | Credential-acquisition runbooks — Google Cloud, Razorpay, Vercel Blob console navigation → [../OPERATIONS.md](../OPERATIONS.md) *(partly done)* |
| `AUTHENTICATION_SYSTEM.md` | The three flow diagrams; the `password-reset:` token-prefix rationale; Resend SPF/DKIM/DMARC setup → [../INTEGRATIONS.md](../INTEGRATIONS.md) |
| `database/SCHEMA_OVERVIEW.md` | Per-model "Design Decisions" bullets — the only record of *why* several columns exist → candidate ADRs |
| `features/cart/CART_STATE.md`, `CART_SYNC.md` | Persist-config rationale; why `useCartSync` mounts once above the router; the sync network budget → cart domain doc |
| `features/shipping/ADMIN_UI_GUIDE.md` | The stated rule that provider credentials never reach the client → [../CONTRACTS.md](../CONTRACTS.md) *(done)* |
| `ARCHITECTURE.md` | Its "Architecture Decisions" section — thin, but the origin of the JWT-over-sessions rationale |
| root `QUICK_START.md` | The deliberately-shaped seed fixtures (out-of-stock item, low-stock items, verified-purchase reviews, guest orders) |
| `server-shipping-README.md` | Provider-selection strategy descriptions → [../../server/shipping/ARCHITECTURE.md](../../server/shipping/ARCHITECTURE.md) *(done)* |
| `server-shipping-shiprocket-COMPLETE.md` | Warehouse-detail env requirements and the "still needs work" list → [../INTEGRATIONS.md](../INTEGRATIONS.md) and [shipping-fulfilment](../specs/shipping-fulfilment/) |

**Not worth salvaging:** `database/SCHEMA_OVERVIEW.md` as a schema reference (superseded by the schema itself), `integrations/NEXTAUTH.md` (largely verbatim source), and the highest code-ratio files — `features/admin-products/PRODUCT_FORM.md`, `features/cart/CART_UI.md`, `features/admin-products/IMAGE_UPLOAD.md`, `features/cart/CART_API.md`.

## Deleting this directory

Once the rows above are mined, remove it — `git log --follow` retains everything. Record the deletion in [../CHANGELOG.md](../CHANGELOG.md).
