# UX — social-selling/whatsapp-templates

- **Status:** Draft
- **Verified:** 2026-11-06
- **Prototype:** [../whatsapp-campaigns/prototype.html](../whatsapp-campaigns/prototype.html) (journeys 1–2; shared with whatsapp-campaigns. Local file: publishing as a private artifact needs a claude.ai login in this session)
- **References:** [spec.md](spec.md), [decisions.md](decisions.md), [src/components/CLAUDE.md](../../../../src/components/CLAUDE.md), [ADR-0050](../../../adr/0050-three-form-factors-on-tailwinds-own-breakpoints.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Phone first (~360px). Buttons are never disabled; an action that cannot happen explains itself on
> tap. Every string below is the string that ships.

## Journeys
Each starts on the screen the person was on just before.
1. **Starter set arrives.** Channels → Connect WhatsApp succeeds → WhatsApp → Templates: twelve
   rows In review, a note saying Meta is checking → hours later, rows show Approved or Rejected.
2. **Write your own.** Templates → Write your own → kind, language, picture, message with inserts,
   button → live preview with the STOP line and price → Send to Meta for approval → row In review.
3. **Fix a rejection.** Templates → Needs you → rejected row shows Meta's reason → Copy and fix →
   editor pre-filled → Send to Meta → new row In review; the rejected one can be archived.
4. **A template is paused.** A campaign using it is held (whatsapp-campaigns journey 4); the row
   says Paused and when it resumes.
5. **Archive.** Row → Archive → dialog → row gone from choices; past campaigns still show it.

## Screens
| Screen | Route / place | New or changed | Serves |
|---|---|---|---|
| WhatsApp area tabs (Templates, Campaigns, Settings) | `/org/[orgId]/whatsapp/*`, under Channels | New | R9 |
| Templates list | `/org/[orgId]/whatsapp/templates` | New | R1, R4, R5, R7 |
| Template editor and preview | `/org/[orgId]/whatsapp/templates/new`, `?from=<id>` for a copy | New | R2, R3, R5 |
| Archive dialog | Over the list | New | R7 |

## State matrix — Templates list
| State | What the person sees | Action |
|---|---|---|
| First use (WhatsApp not connected) | "Templates are the messages you can send to customers on WhatsApp. Connect WhatsApp to get a ready set." | Connect WhatsApp |
| Empty (connected, starter set not yet written) | n/a — the starter set is written in the connect transaction's job within a minute; until then the Loading state shows | — |
| Loading | Six row skeletons | — |
| Partial (some in review) | Note: "Your starter messages are with Meta for approval. Most are approved within a few hours. You can write your own meanwhile." Rows with their own chips | Write your own |
| Success | All rows Approved; no note | Write your own |
| Retryable error | "Couldn't load your templates. Check your connection and try again." | Try again |
| Terminal error | WhatsApp needs reconnecting: "WhatsApp needs reconnecting before templates can change." | Reconnect |
| Refused (Meta's template limit) | On Send: "Meta's limit for templates on this number is reached. Archive one you don't use." | Open archived filter |
| Stale | Row states are as of the last webhook or daily look; "Checked 2 h ago" under the filter row | Check now |
| Long content | Name truncates to one line; tap opens the template | — |
| Many items | Filter chips All, Approved, Needs you; no paging below 100 rows, then 50 per page | — |
| Slow | Skeletons; "Still loading…" after 3 s | — |
| Phone / tablet / desktop | One column / two columns of rows (`md:`) / list at fixed width beside the selected template (`lg:`) | — |

## State matrix — Template row
| State | Chip | Line under the name | Action |
|---|---|---|---|
| In review | In review | "Marketing · ₹0.86 a message" | — |
| Approved | Approved | "Marketing · ₹0.86 a message" | Use in a campaign |
| Rejected | Rejected | "Meta: <reason, ≤300 chars>" | Copy and fix |
| Paused | Paused | "Paused by Meta: customers reported it. It can send again from <date>." | Copy and fix |
| Disabled | Disabled | "Meta disabled this after repeated reports. Write a new one." | Write your own |
| Re-categorised | Approved | "Meta made this Marketing · ₹0.86 a message (you chose Utility)." | — |
| Draft (submit failed) | Draft | "Not sent to Meta yet." | Send to Meta |
| Starter (any state) | + "Starter" tag | — | Copy to edit (never edit in place) |

## State matrix — Template editor
| State | What the person sees | Action |
|---|---|---|
| First use | Kind Marketing, language English, empty message, preview with sample values (Ayesha, Zainab Textiles) | Send to Meta for approval · Save draft |
| Copy | Pre-filled from the source; name gets " (copy)" | Same |
| Field error | Under the field: "A message needs at least one word besides the inserts." · "Up to two buttons." · "A link must start with https://" | Fix field |
| Long content | Counter "812 / 1024", amber past 900, error past 1024: "Meta allows up to 1,024 characters." | — |
| Sending | Button "Sending to Meta…" | — |
| Success | Back to the list; toast "Sent to Meta. We'll show their answer here." | — |
| Retryable error | "Couldn't reach Meta. Your template is saved as a draft. Try again." | Try again |
| Refused | Name taken: "You already have a template called <name> in <language>. Choose another name." | — |
| Phone / tablet / desktop | Preview below the form / beside it (`md:`) / beside it (`lg:`) | — |

## Copy deck
- Kind hint: "Marketing: offers, new stock. Utility: order updates only. Meta checks and may change it."
- Inserts label: "Insert: first name · shop name · product name · price · link"
- STOP line, added to marketing: EN "Reply STOP to stop these messages" · HI "बंद करने के लिए STOP लिखें"
- Price line: "<Kind> · ₹<x.xx> a message" · footer "Prices checked <date> from Meta's India rates."
- Archive dialog: title "Archive <name>?" · "It won't be offered for new campaigns. Past campaigns still show it." · Archive · Keep
- Starter set: English approved by the owner; Hindi read by a native reader before submission (Q3). `{1}` is first name, `{2}` shop name:
  - New arrivals: EN "Hi {1}, new pieces just arrived at {2}. Take a look before they go." · HI "नमस्ते {1}, {2} में नया स्टॉक आया है। ख़त्म होने से पहले देख लें।" · button "See what's new"
  - Offer: EN "Hi {1}, {2} has an offer for you: {3}." · HI "नमस्ते {1}, {2} की ओर से आपके लिए ऑफ़र: {3}" · button "Shop the offer"
  - Back in stock: EN "Hi {1}, {3} is back in stock at {2}." · HI "नमस्ते {1}, {2} में {3} फिर से उपलब्ध है।" · button "View product"
  - Abandoned cart: EN "Hi {1}, you left something in your cart at {2}. It's still there." · HI "नमस्ते {1}, {2} पर आपकी कार्ट में सामान बाकी है।" · button "Finish your order"
  - Auction: EN "Hi {1}, an auction you bid on at {2}: {3}." · HI "नमस्ते {1}, {2} की नीलामी जिसमें आपने बोली लगाई: {3}" · button "See the auction"
  - Order update (utility): EN "Hi {1}, your order {3} from {2} is {4}." · HI "नमस्ते {1}, {2} से आपका ऑर्डर {3} {4} है।" · button "Track order"

## Sign-off
Waiting for the owner's review.
