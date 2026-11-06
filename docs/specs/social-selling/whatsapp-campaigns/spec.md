# Spec — social-selling/whatsapp-campaigns

- **Summary:** A shop sends a WhatsApp message, with products if it likes, to a list of its opted-in customers, seeing who will get it and what it costs first; every WhatsApp send on the platform passes the same consent and caps
- **Status:** Draft
- **Domain:** campaigns, with channels as the WhatsApp plug
- **Phase:** 11 — Listing: one entry, every channel
- **Verified:** 2026-11-06
- **References:** [decisions.md](decisions.md), [ux.md](ux.md), [trd.md](trd.md), parent [social-selling](../spec.md) and its [decisions](../decisions.md), [whatsapp-templates](../whatsapp-templates/spec.md), [audience](../audience/), [notification-hub](../../notification-hub/), [ADR-0004](../../../adr/0004-money-as-integer-paise.md), [ADR-0053](../../../adr/0053-readiness-advises-and-never-gates.md)

> Requirements and product approach only. Technical approach lives in trd.md. Subfeature 13 of
> social-selling. It also owns the one WhatsApp send that notification-hub and a future "Notify me"
> call (parent Q60, Q66).

## What this feature is
A Campaigns page under the shop's WhatsApp. The shop picks an approved template, fills it, adds
products if it wants, picks a list and a time, and sees who will get it, who will not and why, and
the cost, before confirming. Afterwards it sees what was delivered, read and spent.

## Why
Messaging buyers who asked for it is how Indian shops sell on WhatsApp, and the third-party tools
they pay for know nothing of their stock or prices. Each message costs the shop money (parent Q8)
and each unwanted one risks its number. So the send must be honest about cost, never reach anyone
who did not opt in, and never let any caller, ours included, skip those rules.

## Requirements
- R1 — A member creates a campaign: an approved template, its placeholders filled, optionally one
  product or up to 30 products, one named list, now or at a chosen time (Q1, parent Q55, Q75).
- R2 — Before confirming, the shop sees how many will receive it, how many are skipped and why,
  the price per message, and the estimated total in rupees (Q3).
- R3 — Only contacts who consented to this shop on WhatsApp, and have not stopped, ever receive a
  message; checked at the moment of sending (Q2, parent Q9, Q62).
- R4 — A campaign never sends to more people than the shop confirmed (Q4).
- R5 — The shop's WhatsApp frequency cap (default once a day, four a week; any value the shop sets)
  and notification-hub's global cap are both applied, the global one winning (parent Q40, Q74).
- R6 — The shop's monthly spend cap holds: a send that would cross it sends to as many as fit,
  holds the rest and tells the shop (Q6, parent Q32). The cap has no default: the shop sets it while
  connecting WhatsApp (connect-whatsapp) and changes or removes it here (Q7). It covers every paid
  WhatsApp send, inbox templates included.
- R7 — Cost is recorded in paise: estimated at review, actual as Meta reports delivery (Q5).
- R8 — A scheduled campaign can be edited or cancelled until it starts, and stopped while sending;
  unsent messages are not charged (Q13). One held by a paused template, an outage over six hours
  or the spend cap says so and offers the next step (Q12).
- R9 — The report shows sent, delivered, read, failed and skipped with reasons, and actual cost (Q14).
- R10 — Every campaign records who created, scheduled and sent it; every member sees it (Q19).
- R11 — Each buyer gets the template in their chosen language, English when theirs is missing (Q17).
- R12 — One WhatsApp send serves every caller: campaigns here, order updates and alerts from
  notification-hub, Notify me later. It applies R3, R5 and R6 itself and answers sent, skipped with
  a reason, or held; and it reports each buyer's WhatsApp counts for the global cap (Q8–Q10).
- R13 — The WhatsApp settings page shows the caps, this month's spend against the cap, and Meta's
  quality rating for the number, with what each means (Q20).

## Hazards the TRD must answer
- **Consent withdrawn between review and send** — a STOP arriving mid-campaign.
- **Two sends racing the spend cap** — a campaign and an alert both fitting alone, crossing together.
- **A retried job sending twice** — a buyer charged and messaged two times.
- **Meta's actual price differing from the estimate** — the cap counted on the wrong number.
- **A caller bypassing the port** — any code reaching Meta's send endpoint directly.

## Product acceptance
Judged on a phone (~360px) first.
- A1 — On the owner's test number, a campaign to a list of five, two of them not opted in, reaches
  only the three, after the review showed "3 will get it · 2 skipped: not opted in" and its cost.
- A2 — A contact who replies STOP before a scheduled campaign does not receive it.
- A3 — A campaign that would cross the spend cap sends to as many as fit and shows the rest held.
- A4 — A buyer at the WhatsApp cap is skipped and counted as such in the report.
- A5 — A campaign with three products arrives as a multi-product message at the store's prices.
- A6 — A retried send job delivers one message per buyer.
- A7 — notification-hub's call to the port for a non-opted-in buyer answers skipped, never sent.
- A8 — Every state in ux.md's matrices can be reached and reads as written.

## Scope
- **Outcome:** a shop messages its opted-in customers knowing the cost; every WhatsApp send obeys
  consent and caps.
- **In:** R1–R13, tested by A1–A8.
- **Later:** A/B tests, recurring campaigns, attributing orders to a campaign; alerts and order
  updates themselves (notification-hub).

## Open questions
None. Q7 decided by the owner 2026-11-06.
