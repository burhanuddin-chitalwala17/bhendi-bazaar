# Decisions — own-store/storefront-font

- **Verified:** 2026-11-13

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented ones (ADR-0062).
> Owner decides money, policy, irreversible data, external commitments, taste.
> Claude decides the rest, marked `Claude · reversible`. Other documents cite Q ids.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | Which fonts are on the list? | Eight: the four template faces already built (Space Grotesk, Jost, DM Sans, Mulish), Cormorant Garamond and Playfair Display (built, serif), plus two new: **Marcellus** (classic serif caps, for Darbar) and **Poppins** (round, friendly sans, for Bloom/Daily) | Owner | 2026-11-13 | Taste; two new faces add build weight but no per-page cost (spike §4) | implemented (unit 1) |
| Q2 | What does the chosen font apply to? | Text that names something: shop name (header and hero), section titles, product names (cards and product page title), page titles, banner and offer titles, category names. The template's own faces keep prices, descriptions, reviews, story, tagline, buttons, chips, labels, menu, footer, search and cart | Owner | 2026-11-13 | Owner agreed, product names on cards included: one brand across the store; everything read or tapped stays plain. was: recommend headings only | decided |
| Q3 | A body-font choice? | Parked until Q2 says otherwise | Claude · reversible | 2026-11-13 | One outcome | parked |
| Q4 | Fonts outside the list on request? | Parked: a new font is a code change, as a theme is (ADR-0064 D1) | Claude · reversible | 2026-11-13 | Keeps the list curated | parked |
| Q5 | Non-Latin scripts (Gujarati, Urdu, Hindi)? | Parked: no shop sells in them yet | Claude · reversible | 2026-11-13 | New capability | parked |
| Q6 | Is the font part of the look, published with it? | Yes: one draft, one Publish, one Switch back, as theme and palette (storefront-themes Q4) | Claude · reversible | 2026-11-13 | A shared page must not change by a stray tap | implemented (unit 2) |
| Q7 | What is stored? | A font key, never a family name or CSS; an unknown key reads as the template's default | Claude · reversible | 2026-11-13 | ADR-0064 D5 "keys, never values" holds | implemented (unit 1) |
| Q8 | Does this need an ADR? | Yes: ADR-0074 amends ADR-0064 (D1, D6 and "a shop wanting its own font hears no") for headings | Claude · reversible | 2026-11-13 | An ADR's decision is changed by a new ADR | implemented (unit 1) |
| Q9 | Where is the picker? | Storefront → Look, below the palette dots on the chosen template's card: a "Font" row showing the current face; tap opens a sheet of samples set in the shop's own name | Claude · reversible | 2026-11-13 | The shop judges a font on its own name, not "The quick brown fox" | decided |
| Q10 | How are the fonts delivered? | The framework's built-in font loader (`next/font/google`): downloaded at build, served from our own domain, `preload: false` so a store fetches only the faces it shows. No new package; Marcellus and Poppins are in the installed loader | Claude · reversible | 2026-11-13 | Owner asked; same path as the seven faces already in the app (storefront-themes Q7, Q30), R7 | implemented (unit 1) |

## Parked (Later)
- Q3, Q4, Q5 — BACKLOG rows under Phase 12.
