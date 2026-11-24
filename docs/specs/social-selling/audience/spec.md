# Spec — social-selling/audience

- **Summary:** A shop sees who it may message and grows that list: an Audience page of its contacts and their consent, named lists to send to, uploads of customers it has permission for, a checkout box and a store-page button that let buyers opt in
- **Status:** Draft
- **Domain:** audience
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-22
- **References:** [decisions.md](decisions.md), parent [social-selling](../spec.md) and its [decisions](../decisions.md) (Q9, Q27, Q75), [consent-core](../consent-core/spec.md), [whatsapp-campaigns](../whatsapp-campaigns/spec.md)

> Requirements and product approach only. Technical approach lives in trd.md. Module: Reach out.
> The screens and opt-in places over consent-core, which keeps the records and answers the question.

## What this feature is
The Audience page, and the two places buyers opt in that the shop does not control: a box at
checkout and a "Get offers on WhatsApp" button on the shop's page. Plus uploads of customer lists
the shop vouches for, and named lists for campaigns.

## Why
A shop's best customers are the ones who asked to hear from it. Making it easy for buyers to say
yes, and easy for the shop to see and group them, is what makes messaging worth paying for, and
keeps it within consent (parent Q9, Q75).

## Requirements
- R1 — Customers is its own item in the shop menu, with Audience and Campaigns as its tabs (parent
  Q110). Audience shows the shop's contacts with their consent per channel (Opted in, Not yet,
  Stopped) and where it came from; Buyers shows past buyers as Not yet, read live (parent Q9).
- R2 — Checkout shows one unticked box naming the shops in the order and Bhendi Bazaar, on WhatsApp
  and email; guests get it too. Consent is recorded when payment is confirmed, for every shop in
  the order and the platform (Q8, parent Q27).
- R3 — A shop with WhatsApp connected shows "Get offers on WhatsApp" on its store page; it opens
  WhatsApp with YES pre-filled to the shop's number, and sending it opts the buyer in (Q10).
- R4 — A shop uploads a CSV or spreadsheet of customers; ticking "These people agreed to get WhatsApp
  messages from <shop>" makes them messageable, the tick recorded with who, when and which file.
  Invalid numbers are skipped and counted; anyone who stopped stays stopped (Q15, parent Q9).
- R5 — A shop saves named lists: opted-in contacts narrowed by category bought, wishlisted, last
  order within N days, or an uploaded list; only opted-in members are ever counted or sent to (Q17).
- R6 — Phones show masked to the last four digits; the full number shows on tap, and the view is
  recorded. Contacts cannot be exported (Q19).
- R7 — Where the phone's contacts came from the Business app, the page says whether they arrived,
  are still coming, or were not shared.
- R8 — The shop sends its synced contacts one first offer each, asking for consent in it, from
  this page; it sees the cost before sending, progress at up to 100 a day, and who said yes, who
  said stop and who did not answer (Q20, consent-core Q11).

## Hazards the TRD must answer
- **A large upload** (5,000 rows) checked and merged without blocking the page.
- **A list counted on Monday and sent on Friday:** counts always recomputed at send.

## Product acceptance
Judged on a phone (~360px) first.
- A1 — A buyer ticks the box at checkout; after payment they are opted in to the shop and the
  platform, on WhatsApp and email.
- A2 — "Get offers on WhatsApp" on a shop's page opens WhatsApp with YES; sending it shows the buyer
  as Opted in on the Audience page.
- A3 — An upload of 200 rows with the box ticked adds 196 opted-in contacts and says 4 were skipped.
- A4 — A list "Wishlisted, last 30 days" shows its opted-in count and can be picked in a campaign.
- A5 — A masked number shows in full on tap, and the view is recorded.
- A6 — A first offer to 312 synced contacts shows its cost before sending, goes 100 a day, and
  counts 48 yes, 9 stop and the rest no answer; the 48 are Opted in.

## Scope
- **Outcome:** a shop knows who it may message, and grows and groups that list.
- **In:** R1–R8, tested by A1–A6.
- **Later:** contact export (Q19); a platform-wide contact screen (parent Q27).

## Open questions
None.
