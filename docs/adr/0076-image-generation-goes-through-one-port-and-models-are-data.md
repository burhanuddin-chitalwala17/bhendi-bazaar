# ADR-0076: Image generation goes through one port, models are data, and a refusal is never routed around

- **Date:** 2026-11-21
- **Status:** Accepted

## Context

The platform began painting pictures with one hosted model (a scene backdrop through fal, PR-198) and
is about to paint many more: styled product shots, then Instagram and WhatsApp posts
([ai-images](../specs/ai-images/)). Image models change price and quality every few months, each fails
on different products (no model kept every product detail in more than 29% of cases in a 2026
benchmark, [INTEGRATIONS.md](../INTEGRATIONS.md#image-generation-cloudflare-ai-fal)), and the owner wants
to move between them on evidence without a rewrite. Two providers are wanted at once — a gateway that
resells many makers' models (Cloudflare) and one maker's own API (Gemini) — and neither reports cost
or supports an idempotency key.

## Decision

1. **One port.** Every AI picture is asked for through `server/content/generation/` in the platform's
   own terms (purpose, prompt, references as bytes, shape, size, idempotency key). No caller names a
   provider, and the module knows nothing about enhancement, listings or social posts.
2. **One adapter per provider API, on plain `fetch`, and no vendor SDK.** Only `generation/adapters/`
   may name a provider's host, field or credential; `tests/unit/generation-vendor-boundary.test.ts`
   enforces it. Every adapter classifies failure into the same four kinds and passes one contract test.
3. **Models are data.** A model is a registry entry: its adapter, the provider's name for it, its
   reference limit, the shapes and sizes it makes, and a price rule with the date and page it was read
   from. The same model through two providers is two entries. Which ones run, in what order, is a
   setting per purpose.
4. **Fallback on availability, never on refusal.** Unavailable or out of credit passes to the next
   model; a content refusal or an unreadable answer ends the run.
5. **A ledger row per call, written before the call**, so a retry replays a picture already paid for,
   and cost is computed from the price rule at that day's stored exchange rate in integer paise.

## Alternatives considered

- **Vercel's AI SDK** (`generateImage` across providers). The conventional choice, and well made.
  Rejected (ai-images Q5): it puts one vendor's types and release cadence into server code, its image
  surface trails the providers' own (reference images, refusals, cost), and ADR-0037 already keeps the
  host out of the architecture. Two adapters are less code than the integration.
- **LiteLLM or OpenRouter as a proxy.** The same shape as this decision, run as a service. Rejected:
  a Python proxy to host, or a third party between us and every picture, for routing we can write in
  one file.
- **One adapter per model.** Simpler to read per model. Rejected: the gateway alone exposes dozens,
  and a provider's auth, errors and reply shape are per API, not per model.
- **Fallback on any failure.** Maximises the chance of a picture. Rejected: a refused prompt tried on
  every model until one says yes is a refusal ignored.

## Consequences

- ✅ Switching model is a setting change; adding a model is an entry; adding a provider is one file
  that must pass the contract test.
- ✅ Cost is known before the call (a quote) and recorded after it, in paise, at a dated rate.
- ⚠️ Prices in the registry are ours to keep current; each carries its source and date so staleness
  is visible, but nothing updates them.
- ⚠️ The one float in the money path is the ECB rate as it arrives (`Math.round(inr * 100)` in
  `generation/exchange-rate.ts`), turned into integer paise per dollar at the boundary; everything after is integers.
- ⚠️ A worker that dies mid-call cannot know whether the provider billed; the retry calls again and the
  row says so (`retriedAfterUnknown`).
