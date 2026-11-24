# Decisions — social-selling/comment-automations

- **Verified:** 2026-11-22

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented
> ones
> ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste. Claude decides the
> rest, marked `Claude · reversible`. Ids here are this subfeature's own; "parent Qn" means
> [../decisions.md](../decisions.md). Binding here from the parent: Q2, Q7, Q8, Q66, Q89.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q1 | Where are comment rules set, and can they be paused? | In comment-automations' own panel in the post composer: a keyword (default SHOP) and a DM text pre-filled from the products the post names, stored by this module keyed by the post, and editable later from the post. A shop may also keep one shop-wide rule for comments on any post with no rule of its own, including posts made in the Instagram app. Any rule can be paused, per post or shop-wide; a paused rule sends nothing and keeps its settings | Owner | 2026-11-22 | Posting must not know automation (parent Q108); the panel keeps it where the shop composes. was: set on the post when scheduled and stored by post-composer | decided |
| Q3 | How does a comment match a keyword? | The keyword appears as a whole word, ignoring case, accents and surrounding punctuation or emoji; "shop", "SHOP!" and "Shop 🙏" match, "shopping" does not. One keyword per rule, letters and digits only, 2–20 characters | Claude · reversible | 2026-11-06 | Buyers type loosely; whole-word stops false matches | decided |
| Q4 | What do the DM and the optional public reply say? | The DM is the rule's text as the shop last saved it: pre-filled with each product's name and link (our product page), rewritable to anything up to 1,000 characters (parent Q89). An out-of-stock product's link stays, since its page shows the state; an archived product's link is dropped, and if no link is left and the text is still the suggestion, nothing is sent and the activity says why. A public reply under the comment is optional per rule and off by default, "Sent you a DM 📩" unless rewritten (up to 300 characters) | Claude · reversible | 2026-11-06 | Instagram's text limit is 1,000; the link is the default because it sells | decided |
| Q6 | When is a DM sent, and when not? | One DM per comment, ever: a comment is claimed once, so a redelivered webhook or a retry sends nothing more (Meta allows one private reply per comment). One per person per post: a second matching comment from the same person gets nothing. Nothing is sent for a comment older than 7 days (marked "too late"; Meta refuses), nor for the shop's own comments or replies within a thread. At Meta's rate limit (750 private replies an hour per post) sends wait and retry with back-off, so a viral post drains without dropping anything under 7 days old | Claude · reversible | 2026-11-06 | Meta's rule, and the guard against double sends | decided |
| Q11 | What does the shop see? | On each post: the rule, a count of DMs sent today and in total, and the last 50 matches with their outcome (sent, failed with reason, too late, skipped as a repeat). The DM itself appears in the inbox thread like any reply, marked "Automatic" | Claude · reversible | 2026-11-06 | Enough to trust it works; the inbox is where conversations live (inbox-instagram) | decided |
| Q12 | Is a post's comment-to-DM on by default? | Yes: on, keyword SHOP, whenever the post names a product; the panel says so folded ("On · keyword SHOP") and one tap turns it off | Owner | 2026-11-23 | It is the way Instagram shops sell; a shop that names a product wants the link sent (ux-review question 4) | decided |

## Parked (Later)
- Q1 extension — several shop-wide rules (keyword → different DMs); one rule meets every acceptance here.
- Story-mention and story-reply automations; DMs that start from a story are inbox-instagram's.

## Merged ids
Absorbed in the 2026-11-21 audit; read the id on the right.
Q2 → Q1 · Q5 → Q4 · Q7 → Q6 · Q8 → Q6 · Q9 → Q6 · Q10 → Q6 · Q12 → Q1 · Q13 → Q4 · Q14 → parent Q7 · Q15 → parent Q89
