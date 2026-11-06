# UX — notification-hub/hub-core

- **Status:** Draft
- **Verified:** 2026-11-06
- **Prototype:** [../prototype.html](../prototype.html) — journeys 1, 2 and the unsubscribe page in 4 (local file; publish as a private artifact once a claude.ai login is available)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [src/components/CLAUDE.md](../../../../src/components/CLAUDE.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md), [ADR-0050](../../../adr/0050-three-form-factors-on-tailwinds-own-breakpoints.md)

> Phone first (~360px). Nothing is disabled; every string below is the string that ships.

## Journeys
1. **A DM waits.** A buyer DMs → the shop menu's Inbox shows a count → a member opens the inbox and
   answers → the count drops. Unanswered at 9am after 4 hours → the daily email lists it → Open your
   inbox.
2. **Set the cap.** Shop → Notifications → Offers per buyer per day − / + → saved on change.
3. **Turn the daily email off.** Shop → Notifications → Daily email off → no more digests for that
   member; the badge stays.
4. **A buyer unsubscribes.** Marketing email → Unsubscribe → confirmation page; email offers from that
   shop stop.
5. **Goes wrong.** Save fails → the control returns to its last value with a toast; an edited
   unsubscribe link → "This link doesn't work".

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Unread badge | Shop menu items (Inbox, Home) | Changed | R3 |
| Notifications settings | `/org/[orgId]/shop/notifications`, under Shop | New | R4, R6, R8 |
| Daily email | Email to each member | New | R4 |
| Unsubscribe page | `/unsubscribe` (public) | New | R7 |

## State matrix — Notifications settings
| State | What the person sees | Action |
|---|---|---|
| First use | Daily email on; Offers per buyer per day 3; order and alert cards (other subfeatures) | − / + |
| Empty | n/a — the settings always exist with defaults | — |
| Loading | Card skeletons in final positions | — |
| Partial | n/a — one form of independent controls, each saved alone | — |
| Success | Toast "Saved." after a change | — |
| Retryable error | "Couldn't save. Try again." toast; control returns to its last value | Retry by changing again |
| Terminal error | n/a — every setting is valid within its range | — |
| Refused | Cap below 1 or above 10: stepper stops, line "Between 1 and 10 a day." | — |
| Stale | n/a — read fresh on each visit | — |
| Long content | Long shop names in the email subject wrap | — |
| Many items | n/a — fixed set of cards | — |
| Slow | Skeletons; after 3 s "Still loading…" | — |
| Phone / tablet / desktop | One column at every size, at the portal's form width | — |

## State matrix — Unread badge
| State | What the person sees | Action |
|---|---|---|
| First use / Empty | No chip | — |
| Loading | No chip until read; never a spinner | — |
| Success | Count chip, e.g. 3 | Open Inbox |
| Many items | "99+" | — |
| Stale | Refreshed on each navigation | — |
| Retryable / Terminal error, Refused, Partial, Long content, Slow | n/a — a failed read shows no chip | — |
| Phone / tablet / desktop | In the drawer on phone; in the sidebar on `lg:` | — |

## State matrix — Daily email and Unsubscribe page
| State | What the person sees | Action |
|---|---|---|
| Daily email: something waiting | Subject "3 things are waiting for you"; one line per group; Open your inbox | Open your inbox |
| Daily email: nothing waiting | No email | — |
| Unsubscribe: success | "You're unsubscribed" + body | Go to Bhendi Bazaar |
| Unsubscribe: already | Same page | — |
| Unsubscribe: edited link | "This link doesn't work. Use the link in your latest email." | Go to Bhendi Bazaar |
| Unsubscribe: slow / error | "Couldn't unsubscribe. Try again." | Try again |

## Copy deck
- Settings title: "Notifications"
- "Daily email" · "One email at 9am if something is waiting"
- "Offers per buyer per day" · "Across WhatsApp and email. Order updates don't count." · "messages a day" · "Between 1 and 10 a day."
- Toasts: "Saved." · "Couldn't save. Try again."
- Digest subject: "{n} things are waiting for you" (1: "1 thing is waiting for you")
- Digest lines: "{n} conversations waiting over 4 hours ({by platform})" · "{n} posts didn't publish" · "{platform} needs reconnecting" · "{n} posts ready for WhatsApp Status"
- Digest button: "Open your inbox" · footer: "You get this because you're a member of {shop}. Turn off the daily email in Shop → Notifications."
- Marketing email footer: "Don't want offers from {shop} by email? Unsubscribe"
- Unsubscribe: "You're unsubscribed" · "You won't get offers from {shop} by email. Order emails still arrive." · "WhatsApp messages from them are unchanged. Reply STOP there to stop those." · "This link doesn't work. Use the link in your latest email." · "Go to Bhendi Bazaar"

## Sign-off
Awaiting the owner's review.
