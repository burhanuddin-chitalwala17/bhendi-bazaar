# Decisions — social-selling/post-composer

- **Verified:** 2026-11-22

> Replace a Q in place until it is implemented (end its why with "was: …"); supersede only implemented
> ones
> ([ADR-0062](../../../adr/0062-a-decision-is-replaced-until-it-is-implemented-and-superseded-after.md)).
> Owner decides money, policy, irreversible data, external commitments, taste. Claude decides the
> rest, marked `Claude · reversible`. Ids here are this subfeature's own; "parent Qn" means
> [../decisions.md](../decisions.md). Binding here from the parent: Q3, Q7, Q8, Q18, Q26, Q51, Q66,
> Q89.

| Q | Question | Answer | Decided by | Date | Why | State |
|---|---|---|---|---|---|---|
| Q4 | Which destinations and shapes can a post take? | Any combination of Instagram feed, Instagram story and WhatsApp Status, scheduled once (parent Q51); every destination is always offered, connected or not, a not-connected one marked so and waiting for its connection (Q13). Shapes: an image, a carousel (2–10 images, no video inside, as Instagram allows), a reel (one video from the library) or a story (one image or video); feed plus story uses the first item for the story. Captions follow Instagram's limits, 2,200 characters and 30 hashtags counted as typed; over them the field says so and Schedule explains on tap, never disabled | Claude · reversible | 2026-11-06 | Parent Q51; Instagram's own limits, so nothing is accepted that cannot publish | decided |
| Q5 | How far ahead, and how precisely, can a post be scheduled? | Now, or any minute up to 60 days ahead, in IST; shown to the minute. A post publishes within two minutes of its time | Claude · reversible | 2026-11-06 | 60 days covers festival planning; the worker's scheduler is per-minute | decided |
| Q6 | What does a post keep for other modules? | Only the products it is about (0–10). Comment-to-DM's keyword and DM text, and any later panel's settings, are stored by that module, keyed by the post, and shown as a panel the module adds to the composer | Owner | 2026-11-22 | Posting must not know automation (parent Q108). was: the products, a keyword (default SHOP) and a DM text, stored on the post and read by comment-automations (Claude · reversible, 2026-11-06) | decided |
| Q7 | How are posts managed once made? | Posts are listed in four tabs, Saved (waiting for a connection), Scheduled (soonest first), Published (newest first) and Failed; a calendar is Later. A scheduled post can be edited or cancelled (kept as cancelled) until its publish starts; it is then locked, and once published read-only with a link. Duplicate opens a new draft with the same media, caption, products and keyword | Claude · reversible | 2026-11-06 | A post is authored; retired not deleted (ADR-0032). Instagram has no edit-after-publish for media. Replaced in place 2026-11-23: Saved added (Q13) | decided |
| Q13 | Can a shop make a post before connecting Instagram? | Yes. Making a post happens entirely on Bhendi Bazaar, as a product is made before Amazon is connected; only publishing needs the connection. Every destination is offered; one not connected is marked "Not connected" and the post is kept under Saved, each such destination "Waiting for Instagram", its pictures in the library as always. A scheduled destination whose platform is not connected (never, or no longer) at its time also waits as "Waiting for Instagram" instead of failing, and is not retried. Nothing posts by itself on connecting: the shop is told "3 posts waiting for Instagram" and chooses Post now or a time for each. ("Saved" and "Waiting", not "Ready", which the Status kit already uses) | Owner | 2026-11-23 | Never block making a post on a connection; never publish something old by surprise when one appears. was: Q4 offered a destination only once connected | decided |

## Parked (Later)
- Q7 — a calendar view of scheduled posts.

## Merged ids
Absorbed in the 2026-11-21 audit; read the id on the right.
Q1 → parent Q26 · Q2 → parent Q7 · Q3 → Q4 · Q8 → parent Q51 · Q9 → parent Q51 · Q10 → Q7 · Q11 → Q7 · Q12 → Q4 · Q13 → removed
