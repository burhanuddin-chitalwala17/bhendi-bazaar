# UX — social-selling/audience

- **Status:** Draft
- **Verified:** 2026-11-06
- **Prototype:** [prototype.html](prototype.html) (local file, shared with [whatsapp-contacts](../whatsapp-contacts/ux.md); publish as a private artifact once a claude.ai login is available)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [src/components/CLAUDE.md](../../../../src/components/CLAUDE.md), [ADR-0040](../../../adr/0040-an-overlays-surface-is-chosen-by-what-it-holds.md), [ADR-0050](../../../adr/0050-three-form-factors-on-tailwinds-own-breakpoints.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Phone first (~360px). Buttons are never disabled; an action that cannot happen explains itself on
> tap. Every string below is the string that ships. Copy for the checkout box is the owner's
> (Q8).

## Journeys
1. **Opt in at checkout.** Bag → Checkout → tick the box above Pay → Pay → paid. The shop's Audience
   shows the buyer Opted in on WhatsApp and email, source Checkout, with the order code. Unpaid: nothing.
2. **Opt in from the store page.** A shop's store page → Get offers on WhatsApp → WhatsApp opens with
   "YES <code>" → Send → the confirming reply arrives; the shop sees them Opted in, source Store page.
3. **STOP in a chat.** An offer arrives → buyer replies STOP → "Done…" reply → that shop's WhatsApp
   consent shows Stopped; email and Bhendi Bazaar's consent unchanged; lists drop them at once.
4. **See who you can message.** Shop menu → Audience → counts, then contacts with chips → tap a
   contact → Show reveals the phone, recorded.
5. **Upload a list (and when it goes wrong).** Audience → Upload contacts → choose file → tick (or
   not) → Upload → result: added, skipped with reasons, kept as Stopped.
6. **Make a list.** Audience → Lists → New list → name, filters, live count → Save.

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Checkout opt-in box | Checkout, above Pay | Changed | R3 |
| Store-page opt-in button | `/store/[handle]` header and footer, WhatsApp connected only | Changed | R4 |
| Audience · Contacts | `/org/[orgId]/audience`, shop menu under Channels | New | R1, R2, R7, R10 |
| Contact detail | Panel from a contact row | New | R2, R9, R10 |
| Upload sheet | Over Audience | New | R6 |
| Audience · Lists, list editor sheet | `/org/[orgId]/audience?tab=lists` | New | R8 |
| Unsubscribe page | `/unsubscribe/[token]` (from email) | New | R5 |

## State matrix — Checkout opt-in box
| State | What the person sees | Action |
|---|---|---|
| First use | Unticked box: "Send me offers from Noor Textiles and Bhendi Bazaar on WhatsApp and email. Stop any time." | Tick |
| Empty | n/a — a checkout always has a shop | — |
| Loading | n/a — rendered with the checkout | — |
| Partial | Two or more shops: every name, joined "A, B and Bhendi Bazaar" | Tick |
| Success | Ticked; nothing else changes until Pay | Pay |
| Retryable error | n/a — the tick travels with the order; a failed Pay is checkout's existing error | — |
| Terminal error | n/a | — |
| Refused | n/a — anyone may tick | — |
| Stale | n/a | — |
| Long content | Shop names wrap; never truncated, since consent must name each | — |
| Many items | Five shops or more: all named; the line wraps | — |
| Slow | n/a | — |
| Phone / tablet / desktop | Full-width row above Pay / same / in the summary column above Pay | — |

## State matrix — Audience · Contacts
| State | What the person sees | Action |
|---|---|---|
| First use | "Nobody can be messaged yet. People opt in at checkout, on your store page, or by replying YES. You can also upload a list." | Upload contacts |
| Empty | Counts 0 · n · 0 with past buyers in Not yet; same line as first use | Upload contacts |
| Loading | Three count skeletons, six row skeletons | — |
| Partial | Some contacts Opted in, some Not yet, some Stopped; each row chips per channel | Tap a contact |
| Success | After an upload or a reveal, the row updates in place | — |
| Retryable error | "Couldn't load your audience. Check your connection and try again." | Try again |
| Terminal error | n/a — every failure here is retryable | — |
| Refused | A non-member: the portal's existing not-a-member screen | — |
| Stale | n/a — read fresh on every visit | — |
| Long content | Names truncate on one line with the full name in the detail panel | — |
| Many items | 50 a page; search by name or last four digits; chips: Opted in · Not yet · Stopped | Next page |
| Slow | Skeletons stay; after 3 s "Still loading…" | — |
| Phone / tablet / desktop | One column / lists beside contacts (`md:`) / plus a detail panel (`lg:`) | — |

## State matrix — Upload sheet
| State | What the person sees | Action |
|---|---|---|
| First use | "CSV or Excel, up to 5,000 rows. Columns: phone (needed), name, email." | Choose file |
| Empty | File with no rows: "That file has no contacts in it." | Choose another |
| Loading | "Reading eid-walkins.csv…" | — |
| Partial | "196 added as Opted in." · "3 skipped: phone not valid (rows 14, 88, 151)." · "1 kept as Stopped: they said STOP before." | See the list |
| Success | "200 added as Opted in." (or "as Not yet" without the tick) | Done |
| Retryable error | "Upload didn't finish. Nothing was added. Try again." | Try again |
| Terminal error | "We couldn't read that file. Use CSV or Excel with a phone column." | Choose another |
| Refused | Over the limit: "That file has 7,412 rows. Split it into files of 5,000 or fewer." | Choose another |
| Stale | n/a | — |
| Long content | File name truncates in the middle, extension kept | — |
| Many items | 5,000 rows: progress "Adding 2,400 of 5,000…" | — |
| Slow | Progress line stays; sheet can be closed, upload continues | — |
| Phone / tablet / desktop | Bottom sheet / dialog / dialog | — |

## State matrix — Lists
| State | What the person sees | Action |
|---|---|---|
| First use | "Lists group people you can message, for campaigns." | New list |
| Empty | Same as first use | New list |
| Loading | Three row skeletons | — |
| Partial | n/a — a list is one filter | — |
| Success | "Saved Kurta buyers, last 90 days · 84 people." | — |
| Retryable error | "Couldn't save the list. Try again." | Try again |
| Terminal error | n/a | — |
| Refused | Duplicate name: "You already have a list with that name." | Rename |
| Stale | Counts are live: "Updated just now" | — |
| Long content | List names wrap to two lines | — |
| Many items | Search lists by name past 20 | — |
| Slow | "Counting…" until the count returns | — |
| Phone / tablet / desktop | Sheet editor / dialog / dialog | — |

## Copy deck
- Menu: "Audience". Tabs: "Contacts", "Lists". Counts: "Opted in", "Not yet", "Stopped".
- Chips: "Opted in", "Not yet", "Stopped". Sources: "Checkout", "Store page", "Chat", "Upload", "From your phone".
- Store page button: "Get offers on WhatsApp". Pre-filled text: "YES <shop code>".
- Reveal: "Show" → "Shown to you just now. Views are recorded." Failure: "Couldn't show the number. Try again."
- Upload tick: "These people agreed to get WhatsApp messages from <shop>." Under it: "We record who ticked this, when, and the file name."
- Upload buttons: "Upload <n> contacts" / unticked "Upload as Not yet" with "They won't get offers until they opt in."
- Unsubscribe page: "You won't get offers from <sender> by email any more." Link: "Changed your mind? Opt in again from <sender>'s store page."
- Past buyers note: "Buyers from before can't get offers until they opt in."

## Sign-off
Not yet signed off. Awaiting the owner's review of the prototype.
