# Spec — ai-images/improve-with-ai

- **Summary:** One Improve button: its main half takes a short description and a few reference pictures and returns an AI-styled image the seller keeps or regenerates with a new instruction; its arrow keeps today's six exact tools
- **Status:** Draft
- **Domain:** content, reading catalog (media) and subscriptions (credit)
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-21
- **References:** ux.md, trd.md, [../decisions.md](../decisions.md), [image-enhancement](../../image-enhancement/), [generation-foundation](../generation-foundation/), [media-tags](../media-tags/), [shop-credits](../shop-credits/)

> Requirements and product approach only. Technical approach lives in trd.md.

## What this feature is
A seller writes how the photo should look — "worn by a woman walking through a market at dusk" —
adds a few pictures of what they mean, and gets a new picture of their product to keep or redo.

## Why
A clean product photo does not sell an abaya; seeing it worn does. Sellers cannot hire a studio,
and the exact tools cannot invent a person or a place. The seller remains the judge of whether the
product came out right, because no model reliably keeps every stitch (parent overview).

## Requirements
- **R1** — Improve is one split button, wherever a photo can be improved: the library's detail panel
  and each photo in the product form. The main half opens the AI modal; the arrow lists the six
  exact tools, which behave exactly as today (Q1, Q24, Q27).
- **R2** — The modal says in two lines what to write and what helps: name the setting, the light,
  who wears or holds it; add pictures of a pose or a place; keep it short. It shows examples.
- **R3** — The seller writes a description of up to 300 characters. It is sent to the model inside
  the platform's own instructions, never alone, and is recorded with the run (Q28).
- **R4** — The seller adds reference pictures from the library (filtered to Reference) or from the
  device (uploaded into the library tagged Reference). The photo being improved is always the first
  reference. How many more is the limit of the model that will run, shown as "up to N" (Q10, Q23).
- **R5** — The seller chooses **No face** (the default: worn, framed below the chin or turned away,
  never headless) or **With face** (Q3).
- **R6** — Before asking, the modal shows what this picture will cost and the shop's balance. Asking
  takes the credit; an insufficient balance is refused with the top-up route (shop-credits R5, R7).
- **R7** — While it works, the seller sees the photo being improved and can close and come back.
- **R8** — The result shows the new picture, a small thumbnail of the original that shows it full
  size on tap, **Use this** and **Regenerate**. There is no before/after toggle (Q25).
- **R9** — Regenerate reopens the description and references, filled with the last run's, so the
  seller says what to change; it is a new, separately charged run that records the one before (Q26).
- **R10** — Every picture made is kept: it is saved to the library as an AI-made improvement of the
  original, and the result screen steps between this session's versions. **Use this** puts the one
  shown in place — in the product form, in that slot (Q25, Q33).
- **R11** — An AI-made picture is never offered as a marketplace's main image; the channel rules
  treat it as a secondary image only.
- **R12** — The Image enhancement lock and pause apply as they do to the six tools today.
- **R13** — A run the model refused says so in plain words, is refunded, and suggests rewording.
- **R14** — Everything works on a ~360px phone first.

## Product acceptance
- **A1** — On a phone, from an abaya photo in the library: Improve → "worn by a woman in a sunlit
  courtyard, no face" → one reference from the device → Generate → result → Use this; the library
  shows the new picture tagged as an improvement, the reference tagged Reference, the balance lower
  by the cost shown.
- **A2** — Regenerate with "make the light warmer" opens with the previous description and
  references; the new run records the first, and both pictures are in the library.
- **A3** — The arrow lists the six tools; "On plain white" behaves exactly as before, compare included.
- **A4** — With Nano Banana through Cloudflare first, the modal says "up to 2 more pictures"; with
  Gemini direct first, "up to 13 more".
- **A5** — A shop with too little credit sees its balance and how to top up; nothing runs.
- **A6** — An AI picture put to Amazon as the main image is refused as main and offered as a secondary.

## Scope
- **Outcome:** a seller turns a plain product photo into a styled one in under two minutes on a phone.
- **In:** R1–R14.
- **Later:** Instagram and WhatsApp composers reusing the modal (Q27); category sample scenes to pick
  from (Q4).

## Open questions
None.
