# UX — social-selling/meta-foundation

- **Status:** Draft
- **Verified:** 2026-11-22
- **Prototype:** [prototypes/connect.html](../prototypes/connect.html), section "Before it opens" and "Data deletion"
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux-patterns](../ux-patterns.md)

> Mostly invisible: Meta's events, callbacks and signatures have no screen. Two things a person
> sees: the Coming soon card while a platform is closed, and the page a person lands on to check a
> data-deletion request they made through Meta. Patterns from ux-patterns apply throughout.

## Journeys
1. **Before a platform opens.** Shop menu → Channels → "Coming soon" section → Instagram (or
   WhatsApp) card → tap **Why?** → a `HandoffSheet` explains and closes back to the card.
2. **Checking a deletion request.** A person asks Meta to delete what Bhendi Bazaar holds about
   them → Meta shows them a link with a code → they open it → our status page shows the request's
   state → done.

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Coming soon card (Instagram, WhatsApp) | Channels, "Coming soon" section | Changed: the existing planned card gains Why? | R10 |
| Why? sheet | Over Channels | New | R10 |
| Deletion status page | Public, `/data-deletion/<code>` | New | R7 |

## State matrix — Coming soon card
| State | What the person sees | Action |
|---|---|---|
| First use | Card under Coming soon: mark, name, purpose line (channel-copy `PLANNED_CHANNEL_COPY`), badge "Coming soon" | Why? |
| Empty | n/a — the card is the empty state | — |
| Loading | Part of the Channels page skeleton | — |
| Partial | One platform open, the other here: the open one moves up to "Where you sell" with Connect | — |
| Success | n/a — nothing to complete | — |
| Retryable error | n/a — static | — |
| Terminal error | n/a | — |
| Refused | Shop without the Social selling lock: the card shows the lock as every locked action (ux-patterns §8) | Lock opens the plan sheet |
| Stale | n/a — read with the page | — |
| Long content | Names are short; purpose wraps to two lines | — |
| Many items | n/a — two platforms | — |
| Slow | n/a | — |
| Phone / tablet / desktop | One card per row / two across / three across, as the Channels page | — |

## State matrix — Deletion status page
| State | What the person sees | Action |
|---|---|---|
| First use | n/a — reached only by the link Meta gave | — |
| Empty | n/a | — |
| Loading | Skeleton of the two lines | — |
| Partial | n/a — one request | — |
| Success (done) | "Your request is complete. We deleted what Bhendi Bazaar held about you from Instagram and WhatsApp. Reference: 7KQ2-91LM." | — |
| In progress | "We're deleting what Bhendi Bazaar holds about you. It will be done by 22 Dec 2026. Reference: 7KQ2-91LM." | — |
| Retryable error | "Couldn't load your request. Check your connection and try again." | Try again |
| Terminal error | Unknown code: "We couldn't find a request with that reference. Check the link Meta gave you." | — |
| Refused | n/a — anyone with the code may see its status, which holds no personal data | — |
| Stale | n/a — read on open | — |
| Long content | n/a | — |
| Many items | n/a | — |
| Slow | "Still loading…" after 3 s | — |
| Phone / tablet / desktop | One centred column, 40ch wide, from `md:` up | — |

## Copy deck
- Why? sheet, title: "Instagram is coming soon" / "WhatsApp is coming soon"
- Why? sheet, body: "We're finishing Meta's checks so every shop can connect safely. When it opens it appears above, ready to connect."
- Why? sheet, action: "Got it"
- Status page title: "Your data deletion request"
- Strings in the matrix above ship as written.

## Sign-off
Not yet signed off. Awaiting the owner's review with the senior UX review (social-selling Pick up here).
