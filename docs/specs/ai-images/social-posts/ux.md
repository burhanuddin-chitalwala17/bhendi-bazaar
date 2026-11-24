# UX — ai-images/social-posts

- **Status:** Draft
- **Verified:** 2026-11-22
- **Prototype:** [social-selling/prototypes/post.html](../../social-selling/prototypes/post.html), sections "Make a picture", "Write a caption"
- **References:** [spec.md](spec.md), [../decisions.md](../decisions.md) (Q46–Q48), [improve-with-ai ux](../improve-with-ai/ux.md) (signed off), [post-composer ux](../../social-selling/post-composer/ux.md), [social-selling ux-patterns](../../social-selling/ux-patterns.md)

> The signed-off Improve with AI window, opened from the composer with what the composer already
> knows filled in; and a caption drafted in place. The shop learns nothing new: the same window,
> the same cost line before Generate, the same Use this. New here: the post's shape is chosen for
> it, the post's products are the pictures to follow, and words on the picture come from the
> product itself rather than being typed.

## Journeys
1. **Make a picture (A1).** Composer → **Make a picture** → Describe it (improve-with-ai's
   `TaskDialog`) opens with: shape preselected from Where (Portrait for an Instagram post, Tall when
   only a story or Status is picked; the shop can change it), "Pictures to follow" holding the
   post's products' main photos (up to 3, the first product first; × to take one out), the examples
   swapped for post ideas ("Worn on a Mumbai street, festive", "Flat lay with marigolds", "On a café
   table, morning light") → describe → cost line → **Generate** → Working → Result → **Use this** →
   back in the composer, the picture added to the strip, toast "Saved to your library".
2. **Words on the picture (Q48).** In Describe it, a row **Add words** with chips built from the
   live product: "₹1,299", "20% off", "Niqab Boutique", plus **Your words** (40 characters). Picked
   chips are painted by the model; Working says "Checking the words on your picture…" after the
   picture is made; a mismatch is fixed before the shop sees it (regenerated once, then placed
   exactly). The result never shows a wrong price.
3. **Regenerate (A2).** Same as improve-with-ai: Regenerate with an instruction, versions kept,
   both in the library.
4. **Write a caption (A3).** Composer, Caption → **Write a caption** (needs a product; without one
   it explains on tap: "Add a product first, so the caption can say what it is.") → language chips
   **English** · **Hindi** · **Both** (remembered) → pending "Writing…" → the caption box fills
   (replacing only if it was empty; otherwise a sheet: "Replace your caption?" **Replace** /
   **Add below**) → editable at once; **Write again** sits beside it.
5. **Price changed (A4).** The product's price changes after drafting: the composer (if open) and
   the scheduled post show "The price in your caption is ₹1,299; it's now ₹1,199." → **Update
   price** swaps the number in place, no rewrite → toast "Caption updated." Left unchanged, at its time
   each destination is **held**, badge "Check price", the shop told through notifications; the post
   offers **Update price** and **Publish as is** (sheet: "Publish with ₹1,299 in the caption? The
   product is now ₹1,199." **Publish as is** / **Update price**). Nothing goes out stating a price
   the shop did not confirm (Q47).

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Make a picture | improve-with-ai's Describe it, opened from the composer | Changed: preset shape, product references, post examples, Add words | R1, R2, R7 |
| Working / Result | Unchanged, plus "Checking the words…" | Changed | R3, R4, R7 |
| Write a caption | Button and language chips above the composer's caption | New | R5 |
| Replace sheet | `HandoffSheet` | New | R5 |
| Price changed note | Composer caption field; post detail; Posts row badge "Check price" | New | R6 |

## State matrix — Make a picture (only what differs from improve-with-ai)
| State | What the shop sees | Action |
|---|---|---|
| First use | Shape preselected; post's product photos as references; post examples | Generate |
| Empty | No products named and no pictures: references empty, "+ Add picture" as in improve-with-ai | — |
| Many items | More than 3 products: the first 3 photos; "+ Add picture" swaps | — |
| Slow | Checking words adds time: "Checking the words on your picture…" | — |
| Refused | Your words over 40 characters: "Keep it short: 40 characters." | — |
| Success | Use this → composer strip + library, tagged AI-made | — |

## State matrix — Write a caption
| State | What the shop sees | Action |
|---|---|---|
| First use | Button with a sparkle icon; languages under it after the first tap | Write a caption |
| Refused | No product: explains on tap (above) | Add products |
| Loading | Pending "Writing…"; caption box shows a shimmer | — |
| Success | Caption filled, cursor at its end, "Write again" | Write again |
| Retryable error | "Couldn't write a caption. Try again." under the button | Try again |
| Stale | Price changed note (journey 5) | Update price |
| Long content | Draft kept under 600 characters and 8 hashtags, well inside Instagram's limits | — |
| Phone / tablet / desktop | Chips wrap under the button on a phone; inline from `md:` | — |

## Copy deck
- "Make a picture", "Write a caption" → "Writing…", "Write again", "English", "Hindi", "Both".
- "Add words", "Your words", "Checking the words on your picture…".
- "Replace your caption?" · "Replace" · "Add below".
- "The price in your caption is <old>; it's now <new>." · "Update price" · toast "Caption updated."
- Held: badge "Check price"; "Publish as is" → sheet "Publish with <old> in the caption? The product is now <new>." · "Publish as is" · "Update price".
- "Add a product first, so the caption can say what it is."

## Sign-off
Not yet signed off. Awaiting the owner's review with the senior UX review.
