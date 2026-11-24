# UX — social-selling/instagram-publishing

- **Status:** Signed off 2026-11-23
- **Verified:** 2026-11-22
- **Prototype:** [prototypes/post.html](../prototypes/post.html), sections "More for Instagram", "After it goes"
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux-patterns](../ux-patterns.md), [post-composer ux](../post-composer/ux.md)

> A plug with almost no screen of its own: the composer's "More for Instagram" fields, the preview
> crop, the AI-picture note, and the words a published or failed destination shows. Everything
> else happens out of sight; the shop sees Published with a link, or a reason it can act on.

## Journeys
1. **Tag and collaborate.** Composer with Instagram post on → **More for Instagram** → **Tag
   people** (type a handle, tap the picture where it goes; on a phone a pin drops at the tap) →
   **Collaborators** (up to 3 handles) → **Location** (search) → the fold's summary reads "2 tagged ·
   1 collaborator · Mumbai".
2. **Check the crop.** **Preview** → tab "Instagram post" shows each picture at 4:5 with **Square**
   / **Portrait** chips; tab "Instagram story" at 9:16 with the picture fitted on a blurred fill of
   itself (never cropped off the product).
3. **An AI-made picture.** A picked picture carries the AI-made tag → a note sits above the action
   bar, no extra step: "This post uses an AI-made picture. Instagram asks for realistic AI pictures
   to be labelled; we'll add its AI info label." (or, if the API cannot set it, "...; turn on AI info
   when you post, or mention it in your caption.") (Q10)
4. **It goes out.** At the time, the destination reads Publishing, then Published · "View on
   Instagram" opens the post in the app where it can.
5. **It doesn't.** The destination reads Failed with one of the reasons below and its one action.

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| More for Instagram | Fold in the composer | New | R4 |
| Tag people | `ResponsivePicker`-style sheet over the picture | New | R4 |
| Preview tabs | Composer preview | New | R3 |
| AI note | Above the composer's action bar | New | R8 |
| Destination line | Post detail and Posts row | New | R5–R7 |

## State matrix — More for Instagram
| State | What the shop sees | Action |
|---|---|---|
| First use | Folded: "Tag people, collaborators, location" | Open |
| Partial | Folded summary "2 tagged · 1 collaborator" | Open |
| Refused | 4th collaborator: "Up to 3 collaborators." · tags on a reel: "Instagram doesn't allow people tags on reels." · a handle Instagram doesn't know (checked at publish): failed with "@name isn't an Instagram account we can tag." | — |
| Loading | Location search: "Searching…" | — |
| Empty | Location search finds nothing: "No places found. Try a nearby area." | — |
| Phone / tablet / desktop | Phone: tag by tapping the full-width picture; desktop: click on the preview | — |

## Failure reasons, in our words (R6)
| What happened | Line on the destination | Action |
|---|---|---|
| Daily limit reached (Q5) | "Instagram's daily limit reached. Try after 4:00 pm tomorrow." | Publish now |
| Video refused | "Instagram couldn't use this video: it must be 3 to 90 seconds and under 300 MB." | Edit post |
| Picture refused | "Instagram couldn't use this picture. Try another, or a smaller one." | Edit post |
| Caption refused | "Instagram refused the caption. Remove links and check for banned hashtags." | Edit post |
| Connection lost | "Instagram is disconnected. Reconnect, then publish." | Reconnect |
| Temporary, retrying | "Instagram didn't answer. Trying again in 10 min (2 of 3)." | Publish now |
| Retries used | "Instagram didn't answer after 3 tries." | Publish now |

## Copy deck
- "More for Instagram"; "Tag people", "Tap where to tag", "Collaborators", "Up to 3 collaborators.",
  "Location", "Search a place".
- Preview tabs "Instagram post", "Instagram story"; crop chips "Square", "Portrait".
- AI note as in journey 3.
- "Publishing…" · "Published <time>" · "View on Instagram".

## Sign-off
Signed off by the owner on 2026-11-23, after the senior UX review ([ux-review](../ux-review.md)) and the final cross-feature check.
