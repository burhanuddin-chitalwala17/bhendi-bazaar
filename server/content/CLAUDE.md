# CLAUDE.md — content domain

- **Verified:** 2026-11-25
- **Covers:** `server/content/**`

> **Read the project-wide rules first:** [`/CLAUDE.md`](../../CLAUDE.md). This file covers **content** only. Requirements are in [docs/specs/image-enhancement/](../../docs/specs/image-enhancement/) and [docs/specs/ai-images/](../../docs/specs/ai-images/); every decision, with who made it, is in each spec's `decisions.md`.

## Purpose
What is made from an image: the six exact improvements and their ledger (`Enhancement`), renditions, what each channel asks of a photograph, and — from 2026-11-21 — every AI-generated picture through one generation module.

## Boundaries

**Owns:** `server/content/**`, the `Enhancement`, `EnhancementSettings`, `OrgEnhancementPolicy`, `Generation` and `ExchangeRate` tables, and the loose objects under `proposals/` and `generations/`.

**Does not own:** the images themselves. Bytes are read and written only through `mediaAssetService` (catalog's public surface), never `object-store` or a catalog repository ([ADR-0033](../../docs/adr/0033-a-domain-is-reached-through-its-public-surface.md)). A post is social's: `social-picture.service.ts` reads one through `postService` for Make a picture's presets (ai-images/social-posts D1), and catalog's product photos through `productService`.

## Rules

- **Every AI picture goes through `generation/`** ([ADR-0076](../../docs/adr/0076-image-generation-goes-through-one-port-and-models-are-data.md)). A caller builds a `GenerationRequest` and never names a provider. Only `generation/adapters/` may name a provider's host, field or credential; `tests/unit/generation-vendor-boundary.test.ts` fails otherwise.
- **A model is a registry entry, with its price's source and date.** A new model is an entry in `generation/registry.ts`; a new provider is one adapter that passes `tests/unit/generation-adapter-contract.test.ts`. Which models run comes from the model-order sources in `generation/model-order.ts` (today `IMAGE_GEN_MODELS_<PURPOSE>`; purposes `scene`, `listing`, `social`), never a code change; an admin screen for it is a new source placed first (ai-images Q12).
- **Fallback only on availability.** A refusal or an unreadable answer ends the run; it is never tried on another model.
- **Money is micro-dollars to integer paise at a stored day's rate** (`generation/pricing.ts`, `generation/exchange-rate.ts`); never a rate typed into code.
- **The exact tools never change the product's pixels** ([ADR-0059](../../docs/adr/0059-an-enhancement-never-changes-the-products-pixels-proven-before-encoding.md)): `white`, `studio` and `scene` paste the cut-out back and check it before encoding, whichever model painted the scene.
- **A prompt version is never edited once a row records it**; a change is a new version in `generation/prompts.ts`. A shop's own words only ever go inside the marked brief section.

## Known drift
- `TOOL_COST_PAISE` in `enhancement.types.ts` still prices the paid cut-out model in paise typed from a dollar price (`MODEL_SEGMENT_PAISE`). That is the hard-coded rate ai-images Q13 forbids; it stays until segmentation moves onto the generation registry's pricing (generation-foundation TRD, prior art).
