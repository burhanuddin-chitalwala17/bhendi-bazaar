# Spec — ai-images/generation-foundation

- **Summary:** One pipeline makes every AI picture through whichever provider and model the platform has chosen; Cloudflare and Gemini are the first two, a side-by-side comparison picks between models, and "In a scene" is painted through it
- **Status:** Draft
- **Domain:** content
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-21
- **References:** trd.md, [../decisions.md](../decisions.md), [image-enhancement](../../image-enhancement/), [INTEGRATIONS.md](../../../INTEGRATIONS.md#image-generation-cloudflare-ai-fal), [ADR-0037](../../../adr/0037-the-host-is-a-deployment-fact-not-an-architectural-input.md), [ADR-0059](../../../adr/0059-an-enhancement-never-changes-the-products-pixels-proven-before-encoding.md)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is
The machinery every AI picture is made by. A caller asks for a picture with words, reference
images, a shape and a size; the platform decides which provider and model answer.

## Why
Image models change price and quality every few months, and each fails on different products.
The platform must be able to move to a better or cheaper one in an afternoon, on evidence, without
touching the screens or the tools that use it (parent Q5, Q6).

## Requirements
- **R1** — One way to ask for a picture: words, zero or more reference images, a shape, a size and
  how many. The caller never names a provider and never sees a provider's own field names (Q5).
- **R2** — A provider is reached through its own adapter; a model is an entry saying which adapter
  serves it, what it costs, how many references it takes, and which shapes and sizes it makes.
  Adding a model is adding an entry (Q6).
- **R3** — The first adapters are Cloudflare (its own hosted models and the third-party models it
  resells) and Google's Gemini API directly. The present fal painter becomes a third (Q7, Q11).
- **R4** — For each purpose (a listing picture, a scene backdrop; later a social post) the platform
  names an ordered list of models. The first able to take the request runs; "able" includes taking
  as many references as were sent (Q10, Q12).
- **R5** — A model that is unavailable (timed out, failed, out of credit) passes the request to the
  next on the list. A model that **refused the content** does not: the run fails with a reason the
  seller can read. A refusal is never routed around.
- **R6** — Every picture made records which model made it, the words it was given (a versioned
  platform prompt plus anything the seller wrote, kept apart), the references, the cost in paise
  at that day's exchange rate, the rate used, and that it is AI-made (Q2, Q13).
- **R7** — A retried run never pays twice for a picture it already has.
- **R8** — "In a scene" is painted through this pipeline: klein-4b first, Bria as the fallback. The
  product is still pasted back and checked pixel for pixel; nothing a seller sees changes (Q11).
- **R9** — A comparison: the same real photographs through several models, laid side by side with
  each one's cost and time, written as a page the owner opens; nothing is recorded as a run.
- **R10** — The exchange rate is fetched once a day and kept per day; no rate is ever typed into
  code. Without any stored rate, paid generation is refused (Q13).
- **R11** — What the platform absorbs for free tools (cut-outs past the host's free monthly
  allowance) is counted and priced, and the admin sees it beside shop spend (Q16).

## Product acceptance
- **A1** — "In a scene" with the wooden table still works end to end, the ledger shows the model
  that painted it and a cost under a rupee, and the product's pixels are identical to its cut-out.
- **A2** — With the first model's key removed, the same request is painted by the fallback and
  recorded as such; with a model that refuses a request, the run fails with a readable reason and
  no other model is tried.
- **A3** — Changing the model list setting changes which model paints the next run; no screen and
  no code changes.
- **A4** — Twenty photographs through four models produce one comparison page; the database holds
  no new run.
- **A5** — A worker that dies after a model answered resumes without calling the model again.
- **A6** — The admin page shows this month's absorbed cut-out spend.

## Scope
- **Outcome:** any AI picture in the platform is made by a model chosen by a setting, and costed.
- **In:** R1–R11.
- **Later:** OpenAI and Anthropic adapters (Q9); a fidelity check by a vision model; an admin screen
  for the model lists (Q12). No UI — UX stage skipped (A6 adds one line to an existing admin page).

## Open questions
None.
