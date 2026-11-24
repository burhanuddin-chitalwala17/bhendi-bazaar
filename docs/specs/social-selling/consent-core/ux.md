# UX — social-selling/consent-core

- **Status:** Draft
- **Verified:** 2026-11-22
- **Prototype:** [prototypes/reach.html](../prototypes/reach.html), sections "A contact", "What a buyer sees"
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [ux-patterns](../ux-patterns.md), [audience ux](../audience/ux.md), [whatsapp-sending ux](../whatsapp-sending/ux.md)

> Consent has almost no screen of its own: it is the words a buyer gets back when they send YES,
> STOP or HINDI, the one vocabulary every other screen uses for a person's status, and a contact's
> history, which a shop can read but never edit. A shop can never mark someone opted in by hand
> except through the upload's recorded tick (audience).

## The vocabulary (used everywhere)
| Status | Badge | Means, said on tap |
|---|---|---|
| Opted in | ● Opted in (green) | "Agreed to get offers from <shop> on <channel> · <source>, <date>" |
| Not yet | Not yet (grey) | "Hasn't agreed to offers. You can reply when they message you." |
| Stopped | Stopped (red) | "Asked to stop on <date>. Only they can opt back in." |

Per channel: a contact row shows two small badges, "WhatsApp ●" and "Email ●", coloured by status.
Order updates are never blocked by these (whatsapp-sending R1), and the tap text says so once:
"Order updates still reach them."

## Journeys
1. **A buyer says YES.** In WhatsApp: "YES" (or HAAN, हाँ) → reply at once, in their language:
   "You'll now get offers from Niqab Boutique. Reply STOP any time to stop." → the thread shows it
   marked Automatic; the contact turns Opted in.
2. **A buyer says STOP.** "STOP" (UNSUBSCRIBE, बंद, रोको) → "You won't get offers from Niqab
   Boutique. Reply START to get them again." → Stopped at once; a campaign already queued skips them.
3. **HINDI.** → "अब से Niqab Boutique के संदेश हिंदी में आएँगे।" → templates go in Hindi where approved.
4. **A shop reads a contact's history.** Customers → Audience → a contact → **History**: a list,
   newest first ("Stopped · replied STOP · 24 Nov, 9:12 pm", "Opted in · checkout box · BB-7KQ2 · 2
   Nov"). Read-only.

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| Consent badges | Audience rows, contact detail, inbox details panel | New | R2 |
| History | Contact detail, section | New | R2 |
| Confirming replies | The buyer's chat | New | R4 |

## State matrix — History
| State | What the shop sees | Action |
|---|---|---|
| Empty | "No consent yet. They're Not yet on every channel." | — |
| Success | Entries newest first with source and evidence (order number, file name, message) | — |
| Many items | Last 10; "Show all" | — |
| Deleted person | Contact gone; a search for the number finds "This person asked to be removed." | — |

## Copy deck
- Badges "Opted in", "Not yet", "Stopped"; tap texts as in the vocabulary table.
- Replies EN: "You'll now get offers from <shop>. Reply STOP any time to stop." · "You won't get offers from <shop>. Reply START to get them again." · "Messages from <shop> will now be in English."
- Replies HI: "अब आपको <shop> से ऑफ़र मिलेंगे। रोकने के लिए कभी भी STOP भेजें।" · "अब आपको <shop> से ऑफ़र नहीं मिलेंगे। फिर से पाने के लिए START भेजें।" · "अब से <shop> के संदेश हिंदी में आएँगे।"
- History sources "replied YES", "replied STOP", "checkout box · <order>", "upload · <file> · ticked by <member>", "Get offers button".

## Sign-off
Not yet signed off. Awaiting the owner's review with the senior UX review.
