# UX — ai-images/improve-with-ai

- **Status:** Signed off 2026-11-21 (Q31)
- **Verified:** 2026-11-21
- **Prototype:** [published](https://claude.ai/artifact/U3bdiGkYPCKfZdbaihLAE5) · source [../prototype.html](../prototype.html) — journeys 1–4
- **References:** [spec.md](spec.md), [../decisions.md](../decisions.md), today's sheet `src/components/product/improve-dialog.tsx`

> Phone first (~360px). The AI half is the default because it is the new thing; the six exact tools
> stay one tap behind the arrow and do exactly what they do today. Every AI picture costs real money,
> so the price and the balance are on screen before the seller commits, and again on Regenerate.

## Screens
| Screen | Where | Reached by | Serves |
|---|---|---|---|
| Improve split button | Library detail panel (replaces "Improve"); product form photo row and its "Improve…" | — | R1 |
| Tools menu | Anchored to the arrow; on a phone a bottom sheet | Tap ▾ | R1, A3 |
| Today's six-tool sheet | Unchanged, opened at the chosen tool | Pick a tool | R1 |
| Describe it (AI modal) | `TaskDialog`: full screen on a phone, centred dialog from `md:` | Tap Improve | R2–R6 |
| Reference picker | `ResponsivePicker` over the modal: **Library** (every image; Q44) · **This device** (held in the page until Generate; Q43) | "+ Add picture" | R4 |
| Working | Inside the modal | Generate | R7 |
| Result | Inside the modal | The picture is ready | R8–R10 |

## Journeys
1. **Style a photo from the library (A1).** Library → photo → detail panel → **Improve** → Describe it:
   two-line help, examples as tappable chips, text box (0/300), "Your photo" thumbnail fixed first,
   "+ Add picture · up to 2 more", shape **Square · Portrait · Tall · Landscape** (none preselected; Q42), face choice **No face** (selected) / **With face**, cost line
   "This picture costs about ₹2.10 · Credit left ₹2,497.90" → **Generate** → Working ("Making your
   picture… usually under a minute. You can close this and come back.") → Result → **Use this** → toast
   "Saved to your library" → the detail panel shows the new picture.
2. **Not quite right → Regenerate (A2).** Result → **Regenerate** → Describe it reopens with the last
   description and references, the box focused, its hint now "Say what to change — e.g. warmer light,
   longer sleeves" → edit → **Generate again** (cost line again) → Working → Result, with "Version 2 of 2"
   and arrows to step back to version 1. Both are already in the library (Q25); **Use this** places the
   one shown.
3. **Exact tools (A3).** Improve **▾** → menu: On plain white · Studio · In a scene · Cut out · Fix the
   light · Make it bigger, each with today's line → pick → today's sheet at that tool → today's compare →
   Accept / Discard.
4. **Out of credit (A5).** Describe it → the cost line reads "This picture costs about ₹2.10 · Credit left
   ₹1.00" in warning tone → **Generate** is replaced by **Add credit** → the credits page with "How to top
   up" → back.
5. **It goes wrong.** Working → refused: "This description could not be made into a picture. Try
   describing it differently — nothing was charged." with **Edit description**. Failed: "The picture could
   not be made just now. Nothing was charged." with **Try again**.

## Copy (exact)
- Button: **Improve** · arrow `aria-label` "More ways to improve"
- Modal title: **Describe the picture you want**
- Help (two lines): "Say where it is, the light, and who wears or holds it. Add a picture of a pose or a
  place you like — it helps more than words."
- Example chips: "Worn by a woman in a sunlit courtyard" · "On a café table, morning light" · "Folded on
  a bed with white linen" · "Held in hand against a plain wall"
- Box placeholder: "e.g. worn by a woman walking through a market at dusk" · counter "{n}/300"
- References label: "Pictures to follow" · "Your photo" · "+ Add picture" · "Up to {n} more" · at the
  limit "That's the most this picture can use"
- Shape: "Square · 1:1" ("Listings and catalogues") · "Portrait · 4:5" ("Instagram posts") · "Tall · 9:16" ("Status, Stories and Reels") · "Landscape · 4:3" ("Banners and your shop page"); unchosen at Generate: "Choose a shape first" (Q42)
- Face: "No face" (hint "Shown worn, cropped below the chin") · "With face" (hint "Faces can come out
  strange — check closely")
- Cost: "This picture costs about {₹x} · Credit left {₹y}" · when short: "Not enough credit for this
  picture"
- Primary: **Generate** · on Regenerate **Generate again** · when short **Add credit**
- Result: "AI-made picture — check the product looks right before you use it." · original thumbnail
  `aria-label` "See your original photo" · **Use this** · **Regenerate**
- Versions: "Version {n} of {m}" · arrows `aria-label` "Previous version" / "Next version"
- Toasts: "Saved to your library" · in the product form "Photo replaced"

## State matrix — Describe it
| State | What the person sees | Action |
|---|---|---|
| First use | Help, examples, empty box, their photo as the first reference | Type or tap an example |
| Empty | Box empty: Generate stays enabled (never disabled); tapping it shows "Describe the picture first" under the box | Type |
| Loading | Cost line skeleton while the price and balance load (<300 ms) | — |
| Partial | n/a — one form, nothing half-saved | — |
| Success | Moves to Working | — |
| Retryable error | Price could not load: "Couldn't check your credit. Try again." | Try again |
| Terminal error | Image enhancement locked: the lock sheet (today's) | Talk to us |
| Refused | Short of credit (journey 4); shop paused: "Improving photos is paused for your shop" | Add credit / close |
| Stale | Balance changed meanwhile: the server refuses with the new balance, shown inline | Add credit |
| Long content | 300-character limit; the box grows to 5 lines then scrolls | — |
| Many items | References capped by the model's limit; the strip scrolls sideways | — |
| Slow | n/a here; see Working | — |

## State matrix — Working and Result
| State | What the person sees | Action |
|---|---|---|
| Loading / Slow | Their photo dimmed, spinner, "Making your picture…" ; after 60 s "Still working — you can close this and come back" | Close |
| Success | Result screen | Use this / Regenerate |
| Retryable error | "The picture could not be made just now. Nothing was charged." | Try again |
| Terminal error | Refused by the model (journey 5) | Edit description |
| Refused | n/a after start — checks happen before | — |
| Partial | n/a — one picture per run | — |
| Stale | Came back to a run already used: shows the kept picture, "Already saved" | Close |
| Empty / First use / Long / Many | n/a — a single picture | — |

## Decisions confirmed at sign-off
- **U1** — Full screen on a phone (Q32).
- **U2** — Every version is kept and saved to the library; the result screen steps between them (Q25).
- **U3** — In the product form, Use this replaces that slot's photo; the original stays (Q33).
