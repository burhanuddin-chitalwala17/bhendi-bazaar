# UX — social-selling/whatsapp-contacts

- **Status:** Draft
- **Verified:** 2026-11-06
- **Prototype:** [../audience/prototype.html](../audience/prototype.html), journeys 2, 3 and 7 (shared with audience; publish as a private artifact once a claude.ai login is available)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [audience ux](../audience/ux.md)

> Phone first (~360px). This subfeature adds no screen: a line on Audience and replies in the
> buyer's WhatsApp chat. Every string below is the string that ships.

## Journeys
1. **Contacts arrive.** Channels → WhatsApp connected with the Business app kept → Audience shows
   "Contacts from your phone" arriving as Not yet → a contact added on the phone appears later.
2. **They weren't shared.** Same, but Meta sent none within 24 hours → the line says so and how to
   bring them in (disconnect and connect again).
3. **YES in a chat.** A buyer writes YES to the shop → confirming reply → Opted in, source Chat.
4. **STOP in a chat.** A buyer writes STOP → confirming reply → Stopped.
5. **Not a stop.** "please stop sending blue ones" → no change; the message stays a chat.

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| "From your phone" line | Top of Audience · Contacts | Changed | R1, R7 |
| Contact row source "From your phone" / "Removed from your phone" | Audience · Contacts | Changed | R2, R3 |
| Confirming replies | The buyer's WhatsApp chat with the shop | New | R4, R5 |

## State matrix — "From your phone" line
| State | What the person sees | Action |
|---|---|---|
| First use | Before WhatsApp is connected: no line | — |
| Empty | Synced, zero contacts: "Your phone shared no contacts." | — |
| Loading | First 24 hours: "Contacts from your phone are on their way. This can take a few minutes." | — |
| Partial | Arriving: "Contacts from your phone: 412 so far." | — |
| Success | "Contacts from your phone: 1,016 arrived as Not yet. They can't get offers until they reply YES." | — |
| Retryable error | n/a — arrival is Meta's push; nothing to retry | — |
| Terminal error | Not shared after 24 hours: "Contacts from your phone weren't shared when you connected. To bring them in, disconnect and connect WhatsApp again." | Go to Channels |
| Refused | n/a | — |
| Stale | n/a — every change on the phone arrives as it happens | — |
| Long content | Phone-book names truncate on one line, full in the detail panel | — |
| Many items | Thousands: the Contacts list's paging and search (audience ux) | — |
| Slow | Arriving count updates on each visit | — |
| Phone / tablet / desktop | One line above the counts on all three | — |

## State matrix — Confirming reply (in the buyer's chat)
| State | What the person sees | Action |
|---|---|---|
| First use | n/a — a reply exists only after a YES or STOP | — |
| Empty | n/a | — |
| Loading | n/a | — |
| Partial | n/a | — |
| Success (YES) | "You're in. <shop> will send you offers here. Reply STOP any time. Reply HINDI for Hindi." | — |
| Success (STOP) | "Done. <shop> won't send you offers. Reply YES to start again." | — |
| Retryable error | Reply fails: no message; the consent change stands | — |
| Terminal error | n/a | — |
| Refused | A YES already on record: the same reply, no second record | — |
| Stale | n/a | — |
| Long content | Long shop names are sent in full | — |
| Many items | n/a | — |
| Slow | n/a | — |
| Phone / tablet / desktop | WhatsApp's own | — |

## Copy deck
- YES reply (English): "You're in. <shop> will send you offers here. Reply STOP any time. Reply HINDI for Hindi."
- YES reply (Hindi): "आप जुड़ गए। <shop> आपको यहाँ ऑफ़र भेजेगा। रोकने के लिए कभी भी STOP लिखें।"
- STOP reply (English): "Done. <shop> won't send you offers. Reply YES to start again."
- STOP reply (Hindi): "हो गया। <shop> अब आपको ऑफ़र नहीं भेजेगा। फिर से शुरू करने के लिए YES लिखें।"
- Source labels: "From your phone", "Removed from your phone".

## Sign-off
Not yet signed off.
