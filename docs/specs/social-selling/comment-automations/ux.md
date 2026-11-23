# UX — social-selling/comment-automations

- **Status:** Draft
- **Verified:** 2026-11-22
- **Prototype:** [prototypes/converse.html](../prototypes/converse.html), section "Comment-to-DM"
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [post-composer ux](../post-composer/ux.md), [inbox-instagram ux](../inbox-instagram/ux.md), [enquiry-autoreplies ux](../enquiry-autoreplies/ux.md)

> "Comment SHOP and we'll DM you the link" is how Indian Instagram sellers sell; here it is one
> folded panel in the composer, on by default when the post names a product, with the DM already
> written. The shop-wide rule lives beside the other automatic replies.

## Journeys
1. **Set it with the post (A1).** Composer, a product named → panel **Comment-to-DM** shows folded
   "On · keyword SHOP" → open: keyword field (SHOP), the DM preview as the buyer will see it ("Here's
   the Black nidha abaya you asked about 👇" with a product card, **Buy now** and **See details**),
   **Edit message**, switch **Also reply publicly** (off; when on: "Sent you a DM 📩") → schedule.
   The caption helper offers to add "Comment SHOP for the link" if the caption doesn't say it.
2. **See it working.** Post detail → **Comment-to-DM** section: "12 DMs today · 48 in total", the
   last matches ("@ayesha · 'shop 🙏' · DM sent", "@zara · 'SHOP' · already sent to her",
   "@rm · too late, over 7 days") → each opens its conversation.
3. **Pause.** Section's ⋯ → **Pause** → "Paused · new comments won't get a DM" → **Resume**.
4. **Shop-wide rule (A3).** Inbox settings → Auto-replies → **Comments on any post** → keyword,
   message (its own products picked, or "a link to your shop") → on. Posts with their own rule use
   theirs; the line says so.
5. **Nothing left to send.** Every product in the DM archived → the activity row reads "Nothing
   sent · the products in this DM are no longer sold" and the section shows **Edit message**.

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Composer panel | post-composer, panel 6 | New | R1, R4 |
| Post activity | Post detail, section | New | R9 |
| Shop-wide rule | Inbox settings → Auto-replies, section | New | R2 |

## State matrix — Composer panel
| State | What the shop sees | Action |
|---|---|---|
| First use | Folded "On · keyword SHOP"; open shows the pre-filled DM | Edit |
| No product named | Folded "Off · name a product to send its link"; switching on explains on tap | Add products |
| Instagram not picked | Panel hidden (comments come only from Instagram) | — |
| Refused | Keyword with a space: "One word, like SHOP or PRICE." · message over 1,000 characters | — |
| Partial | Message edited: preview updates live | — |
| Phone / tablet / desktop | Full width fold on a phone; same in the dialog | — |

## State matrix — Post activity
| State | What the shop sees | Action |
|---|---|---|
| Empty | "No matching comments yet." | — |
| Success | Counts and recent matches with outcome | Open conversation |
| Paused | Amber "Paused" | Resume |
| Rate limited | "Answering 40 comments · a few minutes" (all under 7 days are answered) | — |
| Many items | Last 20, "See all" | — |

## Copy deck
- "Comment-to-DM", "Keyword", "One word, like SHOP or PRICE.", "For this post only; posts without their own use your shop-wide rule.", "Edit message", "Also reply publicly", "Sent you a DM 📩".
- Default DM "Here's the <product> you asked about 👇" + card, buttons "Buy now", "See details".
- Activity "<n> DMs today · <n> in total", outcomes "DM sent", "Already sent to them", "Too late · over 7 days", "Nothing sent · the products in this DM are no longer sold".
- "Pause" → "Paused · new comments won't get a DM"; "Resume".
- Shop-wide "Comments on any post", "Posts with their own rule use theirs."

## Sign-off
Not yet signed off. Awaiting the owner's review with the senior UX review.
